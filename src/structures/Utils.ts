import { readdirSync } from 'fs';
import { resolve } from 'path';

import { Client } from '@guard-bot/structures';
import { NewsChannel, PermissionFlagsBits, PermissionOverwrites, TextChannel, VoiceChannel } from 'discord.js';
import {
    ChannelModel,
    GuildModel,
    IChannel,
    IChannelOverwrite,
    IPermissions,
    IRole,
    RoleModel,
} from '@guard-bot/models';

export class Utils {
    private client: Client;
    public closingPermissions: boolean;
    public danger: boolean;
    public readonly dangerPerms = [
        PermissionFlagsBits.Administrator,
        PermissionFlagsBits.KickMembers,
        PermissionFlagsBits.ManageGuild,
        PermissionFlagsBits.BanMembers,
        PermissionFlagsBits.ManageRoles,
        PermissionFlagsBits.ManageWebhooks,
        PermissionFlagsBits.ManageNicknames,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageEmojisAndStickers,
    ];

    constructor(client: Client) {
        this.client = client;
        this.closingPermissions = false;
        this.danger = false;
    }

    async setDanger(guildId: string, status: boolean) {
        if (this.danger === status) return;

        const document = await GuildModel.findOneAndUpdate(
            { id: guildId },
            { $set: { 'settings.guard.danger': status } },
            { upsert: true },
        );
        this.client.servers.set(guildId, document.toObject());
    }

    checkLimits({
        userId,
        type,
        limit,
        time,
        canCheck,
    }: {
        userId: string;
        type: string;
        limit?: number;
        time?: number;
        canCheck: boolean;
    }) {
        if (!canCheck) return undefined;

        if (!limit) limit = this.client.config.DEFAULTS.LIMIT.COUNT;
        if (!time) time = this.client.config.DEFAULTS.LIMIT.TIME;

        const now = Date.now().valueOf();
        const key = `${userId}_${type}`;
        const userLimits = this.client.limits.get(key);
        if (!userLimits) {
            this.client.limits.set(key, { count: 1, lastDate: now });
            return {
                maxCount: limit,
                currentCount: 1,
            };
        }

        userLimits.count++;
        const diff = now - userLimits.lastDate;
        if (diff < time && userLimits.count >= limit) return undefined;

        if (diff > time) this.client.limits.set(key, { count: 1, lastDate: now });
        return {
            maxCount: limit,
            currentCount: userLimits.count,
        };
    }

    private getPermissions(permission: PermissionOverwrites) {
        const permissions = {};
        Object.keys(PermissionFlagsBits).forEach((p) => (permissions[p] = null));

        const deny = permission.deny;
        const allow = permission.allow;

        Object.keys(PermissionFlagsBits).forEach((p) => {
            if (allow.has(PermissionFlagsBits[p]) && !deny.has(PermissionFlagsBits[p])) {
                permissions[p] = true;
            } else if (!allow.has(PermissionFlagsBits[p]) && deny.has(PermissionFlagsBits[p])) {
                permissions[p] = false;
            }
        });

        return permissions;
    }

    async getBackup() {
        const guild = this.client.guilds.cache.first();
        if (!guild) return;

        const members = await guild.members.fetch();

        const roles: IRole[] = [];
        guild.roles.cache
            .sort((a, b) => a.position - b.position)
            .filter((role) => !role.managed)
            .forEach((role) => {
                const channelOverwrites: IChannelOverwrite[] = [];
                guild.channels.cache.forEach((channel) => {
                    if (channel.isThread() || !channel.permissionOverwrites.cache.has(role.id)) return;

                    const permission = channel.permissionOverwrites.cache.get(role.id);
                    channelOverwrites.push({
                        id: channel.id,
                        permissions: this.getPermissions(permission) as IPermissions,
                    });
                });

                roles.push({
                    guild: guild.id,
                    id: role.id,
                    channelOverwrites,
                    members: members.filter((m) => m.roles.cache.has(role.id)).map((member) => member.id),
                    name: role.name,
                    color: role.color,
                    position: role.position,
                    permissions: role.permissions.bitfield.toString(),
                    mentionable: role.mentionable,
                    hoist: role.hoist,
                });
            });
        await RoleModel.deleteMany();
        await RoleModel.insertMany(roles);

        const channels: IChannel[] = [];
        guild.channels.cache.forEach(async (channel) => {
            if (channel.isThread()) return;

            await ChannelModel.create({
                guild: guild.id,
                id: channel.id,
                name: channel.name,
                type: channel.type,
                parent: channel.parentId,
                topic: channel.isTextBased() ? (channel as NewsChannel | TextChannel).topic : undefined,
                position: channel.rawPosition,
                userLimit: channel.isVoiceBased() ? channel.userLimit : undefined,
                nsfw: channel.isTextBased() ? channel.nsfw : undefined,
                rateLimitPerUser: channel.isVoiceBased() ? (channel as VoiceChannel).rateLimitPerUser : undefined,
                bitrate: channel.isVoiceBased() ? channel.bitrate : undefined,
                permissionOverwrites: channel.permissionOverwrites.cache.map((permission) => ({
                    id: permission.id,
                    type: permission.type,
                    permissions: this.getPermissions(permission),
                })),
            });
        });
        await ChannelModel.deleteMany();
        await ChannelModel.insertMany(channels);
    }

    async closePermissions() {
        if (this.closingPermissions) return;

        this.closingPermissions = true;

        const guild = this.client.guilds.cache.first();
        if (!guild) return;

        const permissions = [];
        guild.roles.cache
            .filter((role) => this.dangerPerms.some((perm) => role.permissions.has(perm)) && role.editable)
            .forEach((role) => {
                permissions.push({
                    role: role.id,
                    allow: role.permissions.toArray(),
                });
                role.setPermissions([]);
            });
        await GuildModel.updateOne({ id: guild.id }, { $set: { permissions } }, { upsert: true });
    }

    getRandomColor() {
        return Math.floor(Math.random() * (0xffffff + 1));
    }

    async loadCommands() {
        const files = readdirSync(resolve(__dirname, '..', 'commands'));
        files.forEach(async (fileName) => {
            const command = (await import(resolve(__dirname, '..', 'commands', fileName))).default as Guard.ICommand;
            this.client.commands.set(command.usages[0], command);
        });
    }

    async loadEvents() {
        const categories = readdirSync(resolve(__dirname, '..', 'events'));
        categories.forEach((category) => {
            const files = readdirSync(resolve(__dirname, '..', 'events', category));
            files.forEach(async (fileName) => {
                const event = (await import(resolve(__dirname, '..', 'events', category, fileName)))
                    .default as Guard.IEvent;
                this.client.on(event.name, (...args: unknown[]) => event.execute(this.client, [...args]));
            });
        });
    }
}

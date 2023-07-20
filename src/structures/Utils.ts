import { readdirSync } from 'fs';
import { resolve } from 'path';

import { Client } from '@guard-bot/structures';
import {
    Guild,
    NewsChannel,
    PermissionFlagsBits,
    PermissionOverwrites,
    TextChannel,
    VoiceChannel,
    EmbedBuilder,
    codeBlock,
    inlineCode,
    bold,
} from 'discord.js';
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

    sendLimitWarning({
        guild,
        authorName,
        maxCount,
        currentCount,
        type,
    }: {
        guild: Guild;
        authorName: string;
        maxCount: number;
        currentCount: number;
        type: string;
    }) {
        if (!guild.publicUpdatesChannel) return;

        const remainingCount = maxCount - currentCount;
        const content = `${authorName}, ${bold(type)} limitinde ${inlineCode(
            maxCount.toString(),
        )} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(
            remainingCount.toString(),
        )}. (${inlineCode(`${currentCount}/${maxCount}`)})`;

        const embed = new EmbedBuilder({ color: this.client.utils.getRandomColor() });
        embed.setDescription(content);

        guild.publicUpdatesChannel.send({ embeds: [embed] });
    }

    sendPunishLog({
        guild,
        authorName,
        targetName,
        targetType,
        action,
        isSafe,
        operations,
    }: {
        guild: Guild;
        authorName: string;
        targetName: string;
        targetType: string;
        action: string;
        isSafe: boolean;
        operations: string[];
    }) {
        if (!guild.publicUpdatesChannel) return;

        const embed = new EmbedBuilder({ color: this.client.utils.getRandomColor() });

        const updateContent = `${authorName} adlı kullanıcı ${targetName} adlı ${targetType} ${action} ve yasaklandı.`;
        const previousOperations = isSafe
            ? `${codeBlock(
                  'yaml',
                  `# Limite Yakalanmadan Önceki İşlemleri\n${operations.map((o, i) => `${i + 1}. ${o}`).join('\n')}`,
              )}`
            : undefined;

        const description = [updateContent, previousOperations].filter(Boolean).join('\n');
        embed.setDescription(description);

        guild.publicUpdatesChannel.send({
            content: '@everyone',
            embeds: [embed],
        });
    }

    checkLimits({
        userId,
        type,
        limit = this.client.config.DEFAULTS.LIMIT.COUNT,
        time = this.client.config.DEFAULTS.LIMIT.TIME,
        canCheck,
        operation,
    }: {
        userId: string;
        type: string;
        limit?: number;
        time?: number;
        canCheck: boolean;
        operation: string;
    }) {
        if (!canCheck) return undefined;

        const now = Date.now().valueOf();
        const content = `${new Date().toLocaleDateString('tr-TR', {
            hour: 'numeric',
            minute: 'numeric',
        })} -> ${operation}`;
        const key = `${userId}_${type}`;
        const userLimits = this.client.limits.get(key);
        if (!userLimits) {
            this.client.limits.set(key, { operations: [content], lastDate: now });
            return {
                isWarn: true,
                maxCount: limit,
                currentCount: 1,
                operations: [content],
            };
        }

        userLimits.operations.push(content);
        const diff = now - userLimits.lastDate;
        if (diff < time && userLimits.operations.length > limit) {
            return {
                isWarn: false,
                maxCount: limit,
                currentCount: userLimits.operations.length,
                operations: userLimits.operations,
            };
        }

        if (diff > time) this.client.limits.set(key, { operations: [content], lastDate: now });
        return {
            isWarn: true,
            maxCount: limit,
            currentCount: userLimits.operations.length,
            operations: userLimits.operations,
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

    async getBackup(guild: Guild) {
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

    async closePermissions(guild: Guild) {
        if (this.closingPermissions) return;

        this.closingPermissions = true;

        const guildData = this.client.servers.get(guild.id);
        if (!guildData || !guildData.disablePerms) return;

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
        guildData.settings.permissions = permissions;
        await GuildModel.updateOne({ id: guild.id }, { $set: { "settings.guard": guildData } }, { upsert: true });
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

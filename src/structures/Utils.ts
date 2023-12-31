import { readdirSync } from 'fs';
import { resolve } from 'path';

import { ChannelModel, GuildModel, ChannelClass, IChannelOverwrite, RoleClass, RoleModel } from '@/models';
import { Client } from '@/structures';
import {
    EmbedBuilder,
    Guild,
    GuildMember,
    NewsChannel,
    PermissionFlagsBits,
    PermissionOverwrites,
    Snowflake,
    TextChannel,
    VoiceChannel,
    bold,
    codeBlock,
    inlineCode,
} from 'discord.js';

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
    public vanityClient: boolean;

    constructor(client: Client) {
        this.client = client;
        this.closingPermissions = false;
        this.danger = false;
        this.vanityClient = false;
    }

    formatTime(ms: number) {
        return new Date(ms).toLocaleDateString('tr-TR', {
            hour: 'numeric',
            minute: 'numeric',
        });
    }

    isSnowflake(id: string): id is Snowflake {
        return BigInt(id).toString() === id;
    }

    async getMember(guild: Guild, id: string): Promise<GuildMember> {
        if (!id || !this.isSnowflake(id.replace(/\D/g, ''))) return;

        const cache = guild.members.cache.get(id.replace(/\D/g, ''));
        if (cache) return cache;

        let result;
        try {
            result = await guild.members.fetch({
                user: id.replace(/\D/g, ''),
                force: true,
            });
        } catch (e) {
            result = undefined;
        }
        return result;
    }

    async setDanger(guildId: string, status: boolean) {
        if (this.danger === status) return;

        this.danger = status;
        const guildData = this.client.servers.get(guildId);
        if (guildData) this.client.servers.set(guildId, { ...guildData, danger: status });

        await GuildModel.updateOne({ id: guildId }, { $set: { 'guard.danger': status } }, { upsert: true });
    }

    setRoles(member: GuildMember, params: string[] | string): Promise<GuildMember> {
        if (!member.manageable) return undefined;

        const roles = member.roles.cache
            .filter((role) => role.managed)
            .map((role) => role.id)
            .concat(params);
        return member.roles.set(roles);
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
        const channel = guild.channels.cache.find((c) => c.name === 'guard-log') as TextChannel;
        if (channel) {

        const remainingCount = maxCount - currentCount;
        const content = `${authorName}, ${bold(type)} limitinde ${inlineCode(
            maxCount.toString(),
        )} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(
            remainingCount.toString(),
        )}. (${inlineCode(`${currentCount}/${maxCount}`)})`;

        const embed = new EmbedBuilder({ color: this.client.utils.getRandomColor() });
        embed.setDescription(content);

        channel.send({ embeds: [embed] });
        }
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
        const channel = guild.channels.cache.find((c) => c.name === 'guard-log') as TextChannel;

        if (channel) {

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

        channel.send({
            embeds: [embed],
        });
    }
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

    private getPermissions(permission: PermissionOverwrites): Guard.IPermissions {
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

        return permissions as Guard.IPermissions;
    }

    async getBackup(guild: Guild) {
        guild = await guild.fetch();

        const roles: RoleClass[] = [];
        await Promise.all(
            guild.roles.cache
                .sort((a, b) => a.position - b.position)
                .filter((role) => !role.managed && role.id !== guild.id)
                .map(async (role) => {
                    const channelOverwrites: IChannelOverwrite[] = [];
                    guild.channels.cache.forEach((channel) => {
                        if (channel.isThread() || !channel.permissionOverwrites.cache.has(role.id)) return;

                        const permission = channel.permissionOverwrites.cache.get(role.id);
                        channelOverwrites.push({
                            id: channel.id,
                            permissions: this.getPermissions(permission) as Guard.IPermissions,
                        });
                    });

                    let iconBase64: string;
                    if (role.icon) {
                        const res = await fetch(role.iconURL({ forceStatic: true, size: 4096 }));
                        const buffer = await res.arrayBuffer();
                        iconBase64 = Buffer.from(buffer).toString('base64');
                    }

                    roles.push({
                        guild: guild.id,
                        id: role.id,
                        channelOverwrites,
                        members: guild.members.cache
                            .filter((m) => m.roles.cache.has(role.id))
                            .map((member) => member.id),
                        name: role.name,
                        color: role.color,
                        position: role.position,
                        permissions: role.permissions.bitfield.toString(),
                        mentionable: role.mentionable,
                        hoist: role.hoist,
                        iconBase64: iconBase64,
                    });
                }),
        );
        await RoleModel.deleteMany();
        await RoleModel.insertMany(roles);

        const channels: ChannelClass[] = [];
        await Promise.all(
            guild.channels.cache.map(async (channel) => {
                if (channel.isThread()) return;

                channels.push({
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
                    permissionOverwrites: channel.permissionOverwrites.cache.map((permission) => ({
                        id: permission.id,
                        type: permission.type,
                        permissions: this.getPermissions(permission),
                    })),
                });
            }),
        );
        await ChannelModel.deleteMany();
        await ChannelModel.insertMany(channels);

        await GuildModel.updateOne({ id: guild.id }, { $set: { 'guard.lastBackup': Date.now() } }, { upsert: true });

        return {
            rolesSize: roles.length,
            channelsSize: channels.length,
        };
    }

    async closePermissions(guild: Guild) {
        if (this.closingPermissions) return;

        this.closingPermissions = true;

        const guildData = this.client.servers.get(guild.id);
        if (!guildData || !guildData.disablePerms) return;


        guildData.permissions = [];

        const dangerRoles = guild.roles.cache.filter(
            (role) => this.client.utils.dangerPerms.some((perm) => role.permissions.has(perm)) && role.editable,
        );
        for (const role of dangerRoles.values()) {
            guildData.permissions.push({
                name: role.name,
                allow: role.permissions.toArray(),
            });
            await role.setPermissions([]);
            this.client.perms.set(role.name, [`→ ${role.name} - ${role.id}`]);

        }

        await GuildModel.updateOne(
            { id: guild.id },
            { $set: { 'guard.permissions': guildData.permissions } },
            { upsert: true },
        );
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
                const event = (await import(resolve(__dirname, '..', 'events', category, fileName))).default;
                this.client.on(event.name, (...args: unknown[]) => event.execute(this.client, ...args));
            });
        });
    }
}

import { GuildModel } from '@guard-bot/models';
import { EmbedBuilder, bold, codeBlock, inlineCode } from 'discord.js';

const Permissions: Guard.ICommand = {
    usages: ['close-permissions', 'close-perms', 'closeperms', 'cperms', 'perms', 'permissions'],
    execute: async ({ client, message, args }) => {
        const operation = args[0] ? args[0].toLowerCase() : undefined;
        if (!operation || !['aç', 'kapat'].some((arg) => operation === arg)) {
            message.channel.send({
                content: `Lütfen geçerli bir argüman belirt! (${inlineCode('aç')} veya ${inlineCode('kapat')})`,
            });
            return;
        }

        if (client.utils.closingPermissions) client.utils.closingPermissions = false;

        const processRoles: string[] = [];
        const data = (await GuildModel.findOne({ id: message.guildId })) || new GuildModel({ id: message.guildId });
        if (operation === 'aç') {
            (data.settings.guard.permissions || []).forEach((permission) => {
                const role = message.guild.roles.cache.find((r) => r.name === permission.name);
                if (role) {
                    role.setPermissions(permission.allow);
                    processRoles.push(`→ ${role.name}`);
                }
            });
        } else {
            data.settings.guard.permissions = [];

            const dangerRoles = message.guild.roles.cache.filter(
                (role) => client.utils.dangerPerms.some((perm) => role.permissions.has(perm)) && !role.managed,
            );
            for (const role of dangerRoles.values()) {
                data.settings.guard.permissions.push({
                    name: role.name,
                    allow: role.permissions.toArray(),
                });
                await role.setPermissions([]);
                processRoles.push(`→ ${role.name}`);
            }
            await data.save();
        }

        message.channel.send({
            embeds: [
                new EmbedBuilder({
                    author: {
                        name: message.author.username,
                        icon_url: message.author.displayAvatarURL({ size: 4096, forceStatic: true }),
                    },
                    description: [
                        `Bütün yetkiler ${bold(operation === 'aç' ? 'açıldı.' : 'kapatıldı.')}`,
                        codeBlock('yaml', ['# İşlem Yapılan Roller', processRoles.join('\n')].join('\n')),
                    ].join('\n'),
                }),
            ],
        });
    },
};

export default Permissions;

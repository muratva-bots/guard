import { GuildModel } from '@guard-bot/models';
import { bold, inlineCode } from 'discord.js';

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

        const data = (await GuildModel.findOne({ id: message.guildId })) || new GuildModel({ id: message.guildId });
        if (operation === 'aç') {
            data.settings.guard.permissions.forEach((permission) => {
                const role = message.guild.roles.cache.find((r) => r.name === permission.name);
                if (role) role.setPermissions(permission.allow);
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
            }
            await data.save();
        }

        message.channel.send({
            content: `Bütün yetkiler ${bold(operation === 'aç' ? 'açıldı.' : 'kapatıldı.')}`,
        });
    },
};

export default Permissions;

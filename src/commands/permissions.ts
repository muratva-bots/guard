import { GuildModel } from '@/models';
import { EmbedBuilder, bold, codeBlock, inlineCode } from 'discord.js';

const Permissions: Guard.ICommand = {
    usages: ['close-permissions', 'close-perms', 'closeperms', 'cperms', 'perms', 'permissions', 'perm', 'yt'],
    execute: async ({ client, message, args, guildData }) => {
        const operation = args[0] ? args[0].toLowerCase() : undefined;
        if (!operation || !['aç', 'kapat'].some((arg) => operation === arg)) {
            message.channel.send({
                content: `Lütfen geçerli bir argüman belirt! (${inlineCode('aç')} veya ${inlineCode('kapat')})`,
            });
            return;
        }

        if (client.utils.closingPermissions) client.utils.closingPermissions = false;

        const embed = new EmbedBuilder({
            author: {
                name: message.author.username,
                icon_url: message.author.displayAvatarURL({ size: 4096, forceStatic: true }),
            },
            color: client.utils.getRandomColor(),
        });

        const loadingMessage = await message.channel.send({
            embeds: [embed.setDescription('İşlem yapılıyor...')],
        });

        
        if (operation === 'aç') {
            for (const permission of guildData.permissions || []) {
                const role = message.guild.roles.cache.find((r) => r.name === permission.name);
                if (role) {
                    role.setPermissions(permission.allow);
                   client.perms.set(role.name, [`→ ${role.name} - ${role.id}`]);
                }
            }
        } else {
            guildData.permissions = [];

            const dangerRoles = message.guild.roles.cache.filter(
                (role) => client.utils.dangerPerms.some((perm) => role.permissions.has(perm)) && role.editable,
            );
            for (const role of dangerRoles.values()) {
                guildData.permissions.push({
                    name: role.name,
                    allow: role.permissions.toArray(),
                });
                await role.setPermissions([]);
                client.perms.set(role.name, [`→ ${role.name} - ${role.id}`]);
            }

            await GuildModel.updateOne(
                { id: message.guildId },
                { $set: { 'guard.permissions': guildData.permissions } },
                { upsert: true },
            );
        }

        if (!client.perms.size) {
            loadingMessage.edit({ embeds: [embed.setDescription('İşlem yapacak rol bulunmuyor.')] });
            return;
        }

        loadingMessage.edit({
            embeds: [
                embed.setDescription(
                    [
                        `Bütün yetkiler ${bold(operation === 'aç' ? 'açıldı.' : 'kapatıldı.')}`,
                        operation === 'kapat'
                            ? codeBlock('yaml', `# İşlem Yapılan Roller\n${client.perms.map(x => x).join('\n')}`)
                            : undefined,
                    ].join('\n'),
                ),
            ],
        });
    },
};

export default Permissions;

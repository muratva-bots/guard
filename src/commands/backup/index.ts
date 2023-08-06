import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    ComponentType,
    EmbedBuilder,
    codeBlock,
    inlineCode,
} from 'discord.js';
import { setDanger } from './setDanger';
import { checkRoles } from './checkRoles';
import { checkChannels } from './checkChannels';
import { ChannelModel, RoleModel } from '@/models';

const Backup: Guard.ICommand = {
    usages: ['backup'],
    execute: async ({ client, message, guildData }) => {
        const question = await message.channel.send({
            content: 'Veriler yükleniyor...',
        });

        const roles = await RoleModel.find({ guild: message.guildId });
        const channels = await ChannelModel.find({ guild: message.guildId });

        const row = new ActionRowBuilder<ButtonBuilder>({
            components: [
                new ButtonBuilder({
                    custom_id: 'roles',
                    style: ButtonStyle.Primary,
                    disabled: roles.every((r) => message.guild.roles.cache.has(r.id)),
                    label: 'Rolleri Dağıt',
                }),
                new ButtonBuilder({
                    custom_id: 'channels',
                    style: ButtonStyle.Primary,
                    disabled: channels.every((c) => message.guild.channels.cache.has(c.id)),
                    label: 'Kanalları Dağıt',
                }),
                new ButtonBuilder({
                    custom_id: 'danger',
                    label: client.utils.danger === true ? 'Yedeklemeyi Başlat' : 'Yedeklemeyi Durdur',
                    style: client.utils.danger === true ? ButtonStyle.Danger : ButtonStyle.Success,
                }),
            ],
        });

        await question.edit({
            content: '',
            embeds: [
                new EmbedBuilder({
                    color: client.utils.getRandomColor(),
                    author: {
                        name: message.author.username,
                        icon_url: message.author.displayAvatarURL({
                            forceStatic: true,
                            size: 4096,
                        }),
                    },
                    description: [
                        `Merhaba ${message.author} (${inlineCode(
                            message.author.id,
                        )}) koruma botu yedekleme menüsüne hoşgeldin,\n`,
                        codeBlock(
                            'yaml',
                            [
                                `# ${message.guild.name} Sunucusunun Yedekleme Menüsü`,
                                `→ En Son Yedekleme: ${
                                    guildData.lastBackup
                                        ? client.utils.formatTime(guildData.lastBackup)
                                        : 'Yedekleme alınmamış!'
                                }`,
                                `→ En Son Rol Dağıtım: ${
                                    guildData.lastRoleDistribution
                                        ? client.utils.formatTime(guildData.lastRoleDistribution)
                                        : 'Dağıtım yapılmamış!'
                                }`,
                                `→ En Son Kanal Dağıtım: ${
                                    guildData.lastChannelDistribution
                                        ? client.utils.formatTime(guildData.lastChannelDistribution)
                                        : 'Dağıtım yapılmamış!'
                                }`,
                                `→ Veritabanındaki Rol Sayısı: ${roles.length}`,
                                `→ Veritabanındaki Kanal Sayısı: ${channels.length}`,
                                `→ Veritabanındaki Üye Sayısı: ${message.guild.memberCount}`,
                            ].join('\n'),
                        ),
                    ].join('\n'),
                }),
            ],
            components: [row],
        });

        const collector = await question.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i: ButtonInteraction) => i.user.id === message.author.id && i.isButton(),
            time: 1000 * 60 * 5,
        });

        collector.on('collect', async (interaction) => {
            if (interaction.customId === 'danger')
                await setDanger(client, message, guildData, question, row, interaction);
            else if (interaction.customId === 'roles') {
                interaction.deferUpdate();
                await checkRoles(client, question, roles);
            } else if (interaction.customId === 'channels') {
                interaction.deferUpdate();
                await checkChannels(question, channels);
            }
            if (interaction.customId !== 'danger') collector.stop('FINISH');
        });

        collector.on('end', (_, reason) => {
            if (reason === 'time') {
                const row = new ActionRowBuilder<ButtonBuilder>({
                    components: [
                        new ButtonBuilder({
                            custom_id: 'button-end',
                            label: 'Mesajın Geçerlilik Süresi Doldu.',
                            emoji: { name: '⏱️' },
                            style: ButtonStyle.Danger,
                            disabled: true,
                        }),
                    ],
                });

                question.edit({ components: [row] });
            }
        });
    },
};

export default Backup;

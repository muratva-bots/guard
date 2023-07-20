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

// checklerde işlem yapılan rolü veya kanalı göster question edit
// rol backupa icon ekle

const formatTime = (ms: number) =>
    new Date(ms).toLocaleDateString('tr-TR', {
        hour: 'numeric',
        minute: 'numeric',
    });

const Backup: Guard.ICommand = {
    usages: ['backup'],
    execute: async ({ client, message, guildData }) => {
        const row = new ActionRowBuilder<ButtonBuilder>({
            components: [
                new ButtonBuilder({
                    custom_id: 'roles',
                    style: ButtonStyle.Primary,
                    label: 'Rolleri Kontrol Et',
                }),
                new ButtonBuilder({
                    custom_id: 'channels',
                    style: ButtonStyle.Primary,
                    label: 'Kanalları Kontrol Et',
                }),
                new ButtonBuilder({
                    custom_id: 'danger',
                    label: client.utils.danger === true ? 'Yedeklemeyi Başlat' : 'Yedeklemeyi Durdur',
                    style: client.utils.danger === true ? ButtonStyle.Danger : ButtonStyle.Success,
                }),
            ],
        });

        const roleSize = await RoleModel.countDocuments({ guild: message.guildId });
        const channelSize = await ChannelModel.countDocuments({ guild: message.guildId });
        const question = await message.channel.send({
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
                                    guildData.settings.lastBackup
                                        ? formatTime(guildData.settings.lastBackup)
                                        : 'Yedekleme alınmamış!'
                                }`,
                                `→ En Son Rol Kontrol: ${
                                    guildData.settings.lastRoleControl
                                        ? formatTime(guildData.settings.lastRoleControl)
                                        : 'Kontrol edilmemiş!'
                                }`,
                                `→ En Son Kanal Kontrol: ${
                                    guildData.settings.lastChannelControl
                                        ? formatTime(guildData.settings.lastChannelControl)
                                        : 'Kontrol edilmemiş!'
                                }`,
                                `→ Veritabanındaki Rol Sayısı: ${roleSize}`,
                                `→ Veritabanındaki Kanal Sayısı: ${channelSize}`,
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
            interaction.deferUpdate();
            if (interaction.customId === 'danger') await setDanger(client, question, row);
            else if (interaction.customId === 'roles') await checkRoles(client, question);
            else if (interaction.customId === 'channels') await checkChannels(question);

            if (interaction.customId !== 'danger') collector.stop('OP');
        });

        collector.on('end', (_, reason) => {
            if (reason !== 'OP') question.delete();
        });
    },
};

export default Backup;

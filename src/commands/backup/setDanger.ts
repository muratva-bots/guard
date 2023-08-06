import { GuardClass } from '@/models';
import { Client } from '@/structures';
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
    EmbedBuilder,
    Message,
    codeBlock,
    inlineCode,
} from 'discord.js';

export async function setDanger(
    client: Client,
    message: Message,
    guildData: GuardClass,
    question: Message,
    row: ActionRowBuilder<ButtonBuilder>,
    interaction: ButtonInteraction,
) {
    await client.utils.setDanger(question.guildId, !client.utils.danger);

    (row.components[2] as ButtonBuilder)
        .setLabel(client.utils.danger === true ? 'Yedeklemeyi Başlat' : 'Yedeklemeyi Durdur')
        .setStyle(client.utils.danger === true ? ButtonStyle.Danger : ButtonStyle.Success);
    await question.edit({ components: [row] });

    if (client.utils.danger === false) {
        interaction.reply({
            content: 'Manuel yedekleme alınıyor...',
            ephemeral: true,
        });

        const newDatas = await client.utils.getBackup(question.guild);

        interaction.editReply({
            content: 'Manuel yedekleme alındı.',
        });
        question.edit({
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
                                `→ Veritabanındaki Rol Sayısı: ${newDatas.rolesSize}`,
                                `→ Veritabanındaki Kanal Sayısı: ${newDatas.channelsSize}`,
                                `→ Veritabanındaki Üye Sayısı: ${message.guild.memberCount}`,
                            ].join('\n'),
                        ),
                    ].join('\n'),
                }),
            ],
        });
    } else interaction.deferUpdate();
}

import { Client } from '@/structures';
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Message } from 'discord.js';

export async function setDanger(
    client: Client,
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
            content: 'Manuel yedekleme alındı.',
            ephemeral: true,
        });
        await client.utils.getBackup(question.guild);
    } else interaction.deferUpdate();
}

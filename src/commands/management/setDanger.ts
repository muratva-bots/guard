import { Client } from "@guard-bot/structures";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Message } from "discord.js";

export async function setDanger(client: Client, question: Message, row: ActionRowBuilder<ButtonBuilder>) {
    await client.utils.setDanger(question.guildId, !client.utils.danger);
    client.utils.danger = !client.utils.danger;
    if (client.utils.danger === false) await client.utils.getBackup();
    (row.components[2] as ButtonBuilder)
        .setLabel(client.utils.danger === true ? "Yedeklemeyi Başlat" : "Yedeklemeyi Durdur")
        .setStyle(client.utils.danger === true ? ButtonStyle.Danger : ButtonStyle.Success);
    question.edit({ components: [row] });
}
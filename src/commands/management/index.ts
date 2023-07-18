import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	ComponentType,
	EmbedBuilder,
} from "discord.js";
import { setDanger } from "./setDanger";
import { checkRoles } from "./checkRoles";
import { checkChannels } from "./checkChannels";

const Management: Guard.ICommand = {
	usages: [
		"guard-menu",
		"guard-panel",
		"menu",
		"panel",
		"guardpanel",
		"gpanel",
		"gmenu",
		"guardmenu",
	],
	execute: async ({ client, message }) => {
		const row = new ActionRowBuilder<ButtonBuilder>({
			components: [
				new ButtonBuilder({
					custom_id: "roles",
					style: ButtonStyle.Primary,
					label: "Rolleri Kontrol Et",
				}),
				new ButtonBuilder({
					custom_id: "channels",
					style: ButtonStyle.Primary,
					label: "Kanalları Kontrol Et",
				}),
				new ButtonBuilder({
					custom_id: "danger",
					label:
						client.utils.danger === true
							? "Yedeklemeyi Başlat"
							: "Yedeklemeyi Durdur",
					style:
						client.utils.danger === true
							? ButtonStyle.Danger
							: ButtonStyle.Success,
				}),
			],
		});

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
					description: "Aşağıdaki menüden yapacağınız işlemi seçin.",
				}),
			],
			components: [row],
		});

		const collector = await question.createMessageComponentCollector({
			componentType: ComponentType.Button,
			filter: (i: ButtonInteraction) =>
				i.user.id === message.author.id && i.isButton(),
			time: 60000,
		});

		collector.on("collect", async (interaction) => {
			interaction.deferUpdate();
			if (interaction.customId === "danger")
				await setDanger(client, question, row);
			else if (interaction.customId === "roles")
				await checkRoles(client, question, row);
			else if (interaction.customId === "channels")
				await checkChannels(question, row);
		});

		collector.on("end", () => {
			question.delete();
		});
	},
};

export default Management;

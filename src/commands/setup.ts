import { GuildModel } from "@guard-bot/models";
import { ActionRowBuilder, ComponentType, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction, codeBlock, inlineCode } from "discord.js";

const muscles = [
	{ name: "URL Koruması", value: "url" },
	{ name: "Yedekleme", value: "backup" },
	{ name: "Sunucu Ayar Koruması", value: "general" },
	{ name: "Rol Koruması", value: "role" },
	{ name: "Kanal Koruması", value: "channel" },
	{ name: "Emoji Koruması", value: "emoji" },
	{ name: "Çıkartma Koruması", value: "sticker" },
	{ name: "Yasaklama & Atma Koruması", value: "banKick" },
	{ name: "Webhook Koruması", value: "webhook" },
	{ name: "Web Koruması", value: "web" },
	{ name: "Çevrimdışı Koruması", value: "offline" },
	{ name: "Bot Ekleme Koruması", value: "bot" },
]; 

const Setup: Guard.ICommand = {
	usages: ["setup"],
	execute: async ({ client, message, guildData }) => {
		const row = new ActionRowBuilder<StringSelectMenuBuilder>({
			components: [
				new StringSelectMenuBuilder({
					custom_id: "guard-setup",
					placeholder: "Ayar seçilmemiş!",
					options: muscles.map(m => ({
						label: m.name,
						value: m.value,
						emoji: { id: guildData.settings.guard[m.value] ? "1118846618259693638" : "1118834136858243112" }
					}))
				})
			],
			type: ComponentType.StringSelect
		});

		const embed = new EmbedBuilder({
			color: client.utils.getRandomColor(),
			author: {
				name: message.author.username,
				icon_url: message.author.displayAvatarURL({ forceStatic: true, size: 4096 })
			}
		});

		const question = await message.channel.send({
			embeds: [
				embed.setDescription([
					`Merhaba ${message.author} (${inlineCode(message.author.id)}) koruma botu yönetim menüsüne hoşgeldin,\n`,
					`${inlineCode("𝓲")} Aşağıda bulunan menüden korumaları açabilir veya kapatabilirsin.\n`,
					codeBlock("yaml", [
						`# ${message.guild.name} Sunucusunun Koruma Sistemi (Sistem Durumu: )`,
						muscles.map(m => `→ ${m.name}: ${guildData.settings.guard[m.value] ? "🟢 Açık!" : "🔴 Kapalı!"}`).join("\n")
					].join("\n"))
				].join("\n"))
			],
			components: [row]
		});

		const filter = (i: StringSelectMenuInteraction) => i.user.id === message.author.id && i.isStringSelectMenu();
		const collector = question.createMessageComponentCollector({
			filter,
			time: 1000 * 60 * 5,
			componentType: ComponentType.StringSelect
		});

		collector.on("collect", async (i: StringSelectMenuInteraction) => {
			const muscle = muscles.find(m => m.value === i.values[0]);
			guildData.settings.guard[muscle.value] = !guildData.settings.guard[muscle.value];
			await GuildModel.updateOne(
				{ id: message.guildId }, 
				{ $set: { [`settings.guard.${muscle.value}`]: guildData.settings.guard[muscle.value] } },
				{ upsert : true }
			);

			row.components[0].setOptions(muscles.map(m => ({
				label: m.name,
				value: m.value,
				emoji: { id: guildData.settings.guard[m.value] ? "1118846618259693638" : "1118834136858243112" }
			})));

			question.edit({
				embeds: [
					embed.setDescription([
						`Merhaba ${message.author} (${inlineCode(message.author.id)}) koruma botu yönetim menüsüne hoşgeldin,\n`,
						`${inlineCode("𝓲")} Aşağıda bulunan menüden korumaları açabilir veya kapatabilirsin.\n`,
						codeBlock("yaml", [
							`# ${message.guild.name} Sunucusunun Koruma Sistemi (Sistem Durumu: ${muscles.every(m => !guildData.settings.guard[m.value]) ? "Açık!" : "Kapalı!"})`,
							muscles.map(m => `→ ${m.name}: ${guildData.settings.guard[m.value] ? "🟢 Açık!" : "🔴 Kapalı!"}`).join("\n")
						].join("\n"))
					].join("\n"))
				],
				components: [row]
			});
		});

		collector.on("end", () => {
			question.edit({
				embeds: [embed.setDescription("Menünün süresi dolduğu için menü kapatıldı.")],
				components: []
			});
		});
	},
};

export default Setup;

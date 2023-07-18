import { MentionableSelectMenuBuilder } from "@discordjs/builders";
import { GuildModel } from "@guard-bot/models";
import {
	ActionRowBuilder,
	ComponentType,
	EmbedBuilder,
	MentionableSelectMenuInteraction,
	StringSelectMenuBuilder,
	StringSelectMenuInteraction,
	inlineCode,
	codeBlock,
	userMention,
	roleMention,
} from "discord.js";

const titles = {
	FULL: {
		name: "Full",
		description: "Her şey serbesttir.",
	},
	GENERAL: {
		name: "Sunucu Ayarları",
		description: "Sınırlı sunucu ayarı işlemi.",
	},
	ROLE: {
		name: "Rol",
		description: "Sınırlı rol işlemi.",
	},
	CHANNEL: {
		name: "Kanal",
		description: "Sınırlı rol işlemi.",
	},
	EMOJI: {
		name: "Emoji",
		description: "Sınırlı emoji işlemi.",
	},
	STICKER: {
		name: "Çıkartma",
		description: "Sınırlı çıkartma işlemi.",
	},
	BAN_KICK: {
		name: "Yasaklama & Atma",
		description: "Sınırlı yasaklama & atma işlemi.",
	},
};

const Safe: Guard.ICommand = {
	usages: ["safe", "güvenli"],
	execute: async ({ client, message, args }) => {
		if (
			!args[0] ||
			!["liste", "list", "ekle", "add"].some((a) => a === args[0])
		) {
			message.channel.send({
				content: `Geçerli bir argüman belirt! (${inlineCode(
					"liste",
				)} veya ${inlineCode("ekle")})`,
			});
			return;
		}

		const embed = new EmbedBuilder({
			color: client.utils.getRandomColor(),
			author: {
				name: message.author.username,
				icon_url: message.author.displayAvatarURL({
					forceStatic: true,
					size: 4096,
				}),
			},
		});

		if (["ekle", "add"].some((a) => args[0] === a)) {
			const mentionableRow =
				new ActionRowBuilder<MentionableSelectMenuBuilder>({
					components: [
						new MentionableSelectMenuBuilder({
							custom_id: "target",
							max_values: 25,
							min_values: 1,
							placeholder: "Kullanıcı ara...",
						}),
					],
					type: ComponentType.MentionableSelect,
				});

			const question = await message.channel.send({
				embeds: [
					embed.setDescription(
						"Aşağıdaki menüden ekleyeceğiniz kullanıcıları belirtin!",
					),
				],
				components: [mentionableRow],
			});

			const collectedOne = await question.awaitMessageComponent({
				filter: (i: MentionableSelectMenuInteraction) =>
					i.user.id === message.author.id &&
					i.isMentionableSelectMenu(),
				time: 1000 * 60 * 5,
				componentType: ComponentType.MentionableSelect,
			});
			if (collectedOne) {
				collectedOne.deferUpdate();

				const typeRow = new ActionRowBuilder<StringSelectMenuBuilder>({
					components: [
						new StringSelectMenuBuilder({
							custom_id: "type",
							max_values: 25,
							options: Object.keys(titles).map((key) => ({
								label: titles[key].name,
								value: key,
								description: titles[key].description,
							})),
						}),
					],
					type: ComponentType.StringSelect,
				});

				await question.edit({
					embeds: [
						embed.setDescription(
							"Aşağıdaki menüden izinleri belirtin!",
						),
					],
					components: [typeRow],
				});

				const collectedTwo = await question.awaitMessageComponent({
					filter: (i: StringSelectMenuInteraction) =>
						i.user.id === message.author.id &&
						i.isStringSelectMenu(),
					time: 1000 * 60 * 5,
					componentType: ComponentType.StringSelect,
				});
				if (collectedTwo) {
					const safe = client.safes.get(collectedOne.values[0]);
					if (!safe)
						client.safes.set(
							collectedOne.values[0],
							collectedTwo.values as Guard.TSafe[],
						);
					else safe.push(...(collectedTwo.values as Guard.TSafe[]));

					const safes = Array.from(client.safes).map((s) => ({
						id: s[0],
						allow: s[1],
					}));
					await GuildModel.updateOne(
						{ id: message.guildId },
						{ $set: { "settings.guard.safes": safes } },
						{ upsert: true },
					);

					collectedTwo.reply({
						content: "Başarıyla eklendi.",
						ephemeral: true,
					});
					question.delete();
				} else question.delete();
			} else question.delete();
		}

		if (["liste", "list"].some((a) => a === args[0])) {
			message.channel.send({
				embeds: [
					embed.setDescription(
						[
							codeBlock(
								`${message.guild.name} Sunucusunun Güvenli Listesi`,
							),
							client.safes
								.map(
									(v, k) =>
										`${
											client.users.cache.get(k)
												? userMention(k)
												: roleMention(k)
										}: ${v
											.map((p) => titles[p].name)
											.join(", ")}`,
								)
								.join("\n"),
						].join("\n"),
					),
				],
			});
		}
	},
};

export default Safe;

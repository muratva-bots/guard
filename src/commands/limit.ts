import { GuildModel } from "@guard-bot/models";
import { ActionRowBuilder, EmbedBuilder, Interaction, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, codeBlock, inlineCode } from "discord.js";
import ms from "ms";

const limits = [
	{ name: "Sunucu Ayar Koruması", value: "general", count: "generalLimitCount", time: "generalLimitTime" },
	{ name: "Rol Koruması", value: "role", count: "roleLimitCount", time: "roleLimitTime" },
	{ name: "Kanal Koruması", value: "channel", count: "channelLimitCount", time: "channelLimitTime" },
	{ name: "Emoji Koruması", value: "emoji", count: "emojiLimitCount", time: "emojiLimitTime" },
	{ name: "Çıkartma Koruması", value: "sticker", count: "stickerLimitCount", time: "stickerLimitTime" },
	{ name: "Yasaklama & Atma Koruması", value: "banKick", count: "banKickLimitCount", time: "banKickLimitTime" },
];

const Limit: Guard.ICommand = {
	usages: ["limit"],
	execute: async ({ client, message, guildData }) => {
		const row = new ActionRowBuilder<StringSelectMenuBuilder>({
			components: [
				new StringSelectMenuBuilder({
					custom_id: "guard-limit",
					placeholder: "Limitini değişeceğiniz ayarı seçin!",
					options: limits.map(l => ({ label: l.name, value: l.value }))
				})                                          
			]
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
					`Merhaba ${message.author} (${inlineCode(message.author.id)}) koruma botu limit menüsüne hoşgeldin,\n`,
					codeBlock("yaml", [
						`# ${message.guild.name} Sunucusunun Koruma Sistemi (Sistem Durumu: )`,
						limits.map(l => `→ ${l.name}: ${ms(guildData.settings.guard[l.time] || client.config.DEFAULTS.LIMIT.TIME)} süre içinde ${guildData.settings.guard[l.count] || client.config.DEFAULTS.LIMIT.COUNT}`).join("\n")
					].join("\n"))
				].join("\n"))
			],
			components: [row]
		});

		const filter = (i: Interaction) => i.user.id === message.author.id && (i.isModalSubmit() || i.isStringSelectMenu());
		const collector = question.createMessageComponentCollector({
			filter,
			time: 1000 * 60 * 5
		});

		collector.on("collect", async (i: Interaction) => {
            if (i.isStringSelectMenu()) {
                const limit = limits.find(l => l.value === i.values[0]);
                
                const row = new ActionRowBuilder<TextInputBuilder>({
                    components: [
                        new TextInputBuilder({
                            custom_id: "count",
                            max_length: 2,
                            label: "Adet",
                            placeholder: "5",
                            style: TextInputStyle.Short,
                        }),
                        new TextInputBuilder({
                            custom_id: "time",
                            max_length: 3,
                            label: "Süre",
                            placeholder: "15m",
                            style: TextInputStyle.Short,
                        }),
                    ]
                });

                const modal = new ModalBuilder({
                    custom_id: `limit-${limit.value}`,
                    title: limit.name,
                    components: [row]
                })

                i.showModal(modal);
            }

            if (i.isModalSubmit()) {
                const time = i.fields.getTextInputValue("time");
                if (!ms(time)) {
                    collector.stop("Geçerli bir zaman belirt! (15m)");
                    return;
                }

                const count = i.fields.getTextInputValue("count");
                if (!Number(count)) {
                    collector.stop("Geçerli bir adet belirt! (5)");
                    return;
                }

                const limit = limits.find(l => l.value === i.customId.split("-")[1]);            
                guildData.settings.guard[limit.time] = ms(time);
                guildData.settings.guard[limit.count] = count;
                await GuildModel.updateOne(
                    { id: message.guildId },
                    { 
                        $set: {
                            [`settings.guard.${limit.time}`]: guildData.settings.guard[limit.time],
                            [`settings.guard.${limit.count}`]: guildData.settings.guard[limit.count]
                        }
                    },
                    { upsert: true }
                );

                question.edit({
                    embeds: [
                        embed.setDescription([
                            `Merhaba ${message.author} (${inlineCode(message.author.id)}) koruma botu limit menüsüne hoşgeldin,\n`,
                            codeBlock("yaml", [
                                `# ${message.guild.name} Sunucusunun Koruma Sistemi (Sistem Durumu: )`,
                                limits.map(l => `→ ${l.name}: ${ms(guildData.settings.guard[l.time] || client.config.DEFAULTS.LIMIT.TIME)} süre içinde ${guildData.settings.guard[l.count] || client.config.DEFAULTS.LIMIT.COUNT}`).join("\n")
                            ].join("\n"))
                        ].join("\n"))
                    ],
                });
            }
		});

		collector.on("end", (_, reason) => {
			question.edit({
				embeds: [embed.setDescription(reason ? reason : "Menünün süresi dolduğu için menü kapatıldı.")],
				components: []
			});
		});
	},
};

export default Limit;

import { LimitFlags, SafeFlags } from "@guard-bot/enums";
import { AuditLogEvent, Events, bold, inlineCode } from "discord.js";

const GuildUpdate: Guard.IEvent = {
	name: Events.GuildUpdate,
	execute: async (
		client,
		[oldGuild, newGuild]: Guard.ArgsOf<Events.GuildUpdate>,
	) => {
		try {
			const guildData = client.servers.get(newGuild.id);
			if (!guildData || !guildData.settings.guard.general) return;

			const entry = await newGuild
				.fetchAuditLogs({ limit: 1, type: AuditLogEvent.GuildUpdate })
				.then((audit) => audit.entries.first());
			if (
				!entry ||
				!entry.executor ||
				entry.executor.bot ||
				Date.now() - entry.createdTimestamp > 5000
			)
				return;

			const staffMember = newGuild.members.cache.get(entry.executorId);
			const safe = [
				...[
					staffMember
						? client.safes.find((_, k) =>
								staffMember.roles.cache.get(k),
						  )
						: [],
				],
				...(client.safes.get(entry.executorId) || []),
			];
			if (safe.includes(SafeFlags.Full)) return;

			const limit = client.utils.checkLimits({
				userId: entry.executor.id,
				type: LimitFlags.General,
				limit: guildData.settings.guard.generalLimitCount,
				time: guildData.settings.guard.generalLimitTime,
				canCheck: safe.includes(SafeFlags.General),
			});
			if (limit) {
				if (newGuild.publicUpdatesChannel) {
					const remainingCount = limit.maxCount - limit.currentCount;
					const content = `${entry.executor}, ${bold(
						"sunucu ayar",
					)} limitinde ${inlineCode(
						limit.maxCount.toString(),
					)} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(
						remainingCount.toString(),
					)}. (${inlineCode(
						`${limit.currentCount}/${limit.maxCount}`,
					)})`;
					newGuild.publicUpdatesChannel.send({ content });
				}
				return;
			}

			await newGuild.members.ban(entry.executor.id, {
				reason: "Koruma!",
			});
			await client.utils.closePermissions();
			await client.utils.setDanger(newGuild.id, true);
			await oldGuild.edit(client.guildSettings);

			// readye url koruması yapmamız gerek ama self ile yapılıyor sadece nasıl yapıcaz?

			if (newGuild.publicUpdatesChannel) {
				const action = safe.length
					? "güncelledi limite ulaştı"
					: "güncelledi";
				newGuild.publicUpdatesChannel.send(
					`@everyone ${entry.executor} adlı kullanıcı sunucuyu ${action} ve yasaklandı.`,
				);
			}
		} catch (error) {
			console.error("Guild Update Error:", error);
		}
	},
};

export default GuildUpdate;

import { SafeFlags } from "@guard-bot/enums";
import { AuditLogEvent, Events, bold, inlineCode } from "discord.js";

const GuildStickerUpdate: Guard.IEvent = {
    name: Events.GuildStickerUpdate,
    execute: async (client, [sticker]: Guard.ArgsOf<Events.GuildStickerUpdate>) => {
        try {
            const guildData = client.servers.get(sticker.guild.id);
            if (!guildData || !guildData.settings.guard.sticker) return;

            const entry = await sticker.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.StickerUpdate }).then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = sticker.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || [])
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits(
                entry.executor.id,
                'sticker_operations',
                guildData.settings.guard.stickerLimitCount,
                guildData.settings.guard.stickerLimitTime,
                safe.includes(SafeFlags.Sticker) 
            );
            if (limit) {
                if (sticker.guild.publicUpdatesChannel) {
                    const remainingCount = limit.maxCount - limit.currentCount;
                    const content = `${entry.executor}, ${bold("çıkartma")} limitinde ${inlineCode(limit.maxCount.toString())} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(remainingCount.toString())}. (${inlineCode(`${limit.currentCount}/${limit.maxCount}`)})`;
                    sticker.guild.publicUpdatesChannel.send({ content });
                }
                return;
            }

            await sticker.edit({
                name: sticker.name,
                tags: sticker.tags,
                description: sticker.description
            });

            if (sticker.guild.publicUpdatesChannel) {
                const stickerName = `${sticker.name} (${inlineCode(sticker.id)})`;
                const action = safe.length ? "güncelledi limite ulaştı" : "güncelledi";
                sticker.guild.publicUpdatesChannel.send(`@everyone ${entry.executor} adlı kullanıcı ${stickerName} adlı çıkartmayı ${action} ve yasaklandı.`);
            }
        } catch (error) {
            console.error("Guild Sticker Update Error:", error);
        }
    },
};

export default GuildStickerUpdate;
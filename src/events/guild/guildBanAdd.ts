import { LimitFlags, SafeFlags } from '@guard-bot/enums';
import { AuditLogEvent, Events, bold, inlineCode } from 'discord.js';

const GuildBanAdd: Guard.IEvent = {
    name: Events.GuildBanAdd,
    execute: async (client, [ban]: Guard.ArgsOf<Events.GuildBanAdd>) => {
        try {
            const guildData = client.servers.get(ban.guild.id);
            if (!guildData || !guildData.settings.guard.banKick) return;

            const entry = await ban.guild
                .fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd })
                .then((audit) => audit.entries.first());
            if (!entry || !entry.executor || entry.executor.bot || Date.now() - entry.createdTimestamp > 5000) return;

            const staffMember = ban.guild.members.cache.get(entry.executorId);
            const safe = [
                ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) : []],
                ...(client.safes.get(entry.executorId) || []),
            ];
            if (safe.includes(SafeFlags.Full)) return;

            const limit = client.utils.checkLimits({
                userId: entry.executor.id,
                type: LimitFlags.BanKick,
                limit: guildData.settings.guard.banKickLimitCount,
                time: guildData.settings.guard.banKickLimitTime,
                canCheck: safe.includes(SafeFlags.BanKick),
            });
            if (limit) {
                if (ban.guild.publicUpdatesChannel) {
                    const remainingCount = limit.maxCount - limit.currentCount;
                    const content = `${entry.executor}, ${bold('yasaklama & atma')} limitinde ${inlineCode(
                        limit.maxCount.toString(),
                    )} hakkından birini kullandığı için uyarıldı. Kalan limit ${inlineCode(
                        remainingCount.toString(),
                    )}. (${inlineCode(`${limit.currentCount}/${limit.maxCount}`)})`;
                    ban.guild.publicUpdatesChannel.send({ content });
                }
                return;
            }

            await ban.guild.members.ban(entry.executor.id, {
                reason: 'Koruma!',
            });
            await client.utils.closePermissions();
            await client.utils.setDanger(ban.guild.id, true);
            await ban.guild.members.unban(entry.executor.id);

            if (ban.guild.publicUpdatesChannel) {
                const userName = bold(ban.user.username);
                const action = safe.length ? 'yasakladı limite ulaştı' : 'yasakladı';
                ban.guild.publicUpdatesChannel.send(
                    `@everyone ${entry.executor} adlı kullanıcı ${userName} adlı kullanıcıyı ${action} ve yasaklandı.`,
                );
            }
        } catch (error) {
            console.error('Guild Ban Add Error:', error);
        }
    },
};

export default GuildBanAdd;

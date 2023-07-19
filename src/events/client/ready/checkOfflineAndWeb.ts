import { GuildModel } from '@guard-bot/models';
import { Client } from '@guard-bot/structures';
import { EmbedBuilder, Guild, inlineCode } from 'discord.js';

async function checkOfflineAndWeb(client: Client, guild: Guild) {
    const guildData = client.servers.get(guild.id);
    if (!guildData) return;

    const embed = new EmbedBuilder({
        color: client.utils.getRandomColor(),
        timestamp: Date.now(),
    });

    guild.members.cache
        .filter(
            (m) =>
                !client.staffs.has(m.id) &&
                client.utils.dangerPerms.some((p) => m.permissions.has(p)) &&
                guild.members.me.roles.highest.position > m.roles.highest.position &&
                ((guildData.settings.web && m.presence?.clientStatus.web) ||
                    (guildData.settings.offline && m.presence?.status === 'offline')) &&
                !m.user.bot,
        )
        .forEach((m) => {
            client.staffs.set(
                m.id,
                m.roles.cache.map((r) => r.id),
            );
            m.roles.set(m.roles.cache.filter((r) => r.managed));

            if (guild.publicUpdatesChannel) {
                guild.publicUpdatesChannel.send({
                    embeds: [
                        embed.setTitle(m.presence?.clientStatus.web ? 'Web Girişi!' : 'Çevrimıdışı!').setDescription(
                            `${m} (${inlineCode(m.id)}) adlı kullanıcının ${m.roles.cache
                                .filter((r) => !r.managed)
                                .map((r) => r)
                                .join(',')} rolleri çekildi!`,
                        ),
                    ],
                });
            }
        });

    guild.members.cache
        .filter(
            (m) =>
                client.staffs.has(m.id) &&
                client.utils.dangerPerms.some((p) => m.permissions.has(p)) &&
                guild.members.me.roles.highest.position > m.roles.highest.position &&
                guildData.settings.offline &&
                m.presence?.status !== 'offline' &&
                guildData.settings.web &&
                !m.presence?.clientStatus.web,
        )
        .forEach((m) => {
            m.roles.set(client.staffs.get(m.id));
            client.staffs.delete(m.id);
        });

    const staffs = Array.from(client.staffs).map((s) => ({
        id: s[0],
        roles: s[1],
    }));
    await GuildModel.updateOne({ id: guild.id }, { $set: { 'settings.guard.staffs': staffs } }, { upsert: true });
}

export default checkOfflineAndWeb;

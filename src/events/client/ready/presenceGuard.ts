import { GuildModel } from '@/models';
import { Client } from '@/structures';
import { EmbedBuilder, Guild, TextChannel, codeBlock, inlineCode } from 'discord.js';

async function presenceGuard(client: Client, guild: Guild) {
    const guildData = client.servers.get(guild.id);
    if (!guildData || (!guildData.web && !guildData.offline)) return;
    const embed = new EmbedBuilder({
        color: client.utils.getRandomColor(),
        timestamp: Date.now(),
    });
    let firstCheck: boolean = false;
    const offlineOrWebStaffs = [...guild.members.cache.values()].filter(
        (m) =>
            guild.members.me.roles.highest.position > m.roles.highest.position &&
            !m.user.bot &&
            !client.staffs.has(m.id) &&
            ((guildData.web && m.presence?.clientStatus.web) ||
                (guildData.offline && (!m.presence || m.presence.status === 'offline'))) &&
            client.utils.dangerPerms.some((perm) => m.permissions.has(perm)),
    );

    offlineOrWebStaffs.forEach((m, i) => {
        const dangerRoleIds = m.roles.cache.filter((r) => !r.managed && r.permissions.any(client.utils.dangerPerms)).map((r) => r.id);
        client.staffs.set(m.id, dangerRoleIds);
        m.roles.remove(dangerRoleIds);

        if (i + 1 === offlineOrWebStaffs.length) firstCheck = true;
        const channel = guild.channels.cache.find((c) => c.name === 'guard-log') as TextChannel;

        if (channel) {
            channel.send({
                embeds: [
                    embed.setDescription(
                        [
                            `${m} (${inlineCode(m.id)}) adlı kullanıcı ${
                                m.presence?.clientStatus.web ? 'internet sitesinden giriş yaptığı' : 'çevrimdışı olduğu'
                            } için yetkileri çekildi.`,
                            codeBlock(
                                'yaml',
                                [
                                    '# Çekilen Rolleri',
                                    m.roles.cache.filter((r) => !r.managed && r.permissions.any(client.utils.dangerPerms))
                                        .map((r) => `→ ${r.name}`)
                                        .join('\n'),
                                ].join('\n'),
                            ),
                        ].join('\n'),
                    ),
                ],
            });
        }
    });

    let secondCheck: boolean = false;
    const oldDatas = [...guild.members.cache.values()].filter(
        (m) =>
            client.staffs.has(m.id) &&
            !(
                (guildData.web && m.presence?.clientStatus.web) ||
                (guildData.offline && (!m.presence || m.presence.status === 'offline'))
            ),
    );

    oldDatas.forEach((m, i) => {
        m.roles.add(client.staffs.get(m.id));
        client.staffs.delete(m.id);
        if (i + 1 === oldDatas.length) secondCheck = true;
    });

    if (firstCheck && secondCheck) {
        const oldStaffs = guildData.staffs || [];
        const staffs = Array.from(client.staffs).map((s) => ({ id: s[0], roles: s[1] }));
        if (JSON.stringify(oldStaffs) === JSON.stringify(staffs)) return;

        await GuildModel.updateOne({ id: guild.id }, { $set: { 'guard.staffs': staffs } }, { upsert: true });
    }
}

export default presenceGuard;

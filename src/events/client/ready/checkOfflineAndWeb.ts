import { GuildModel } from '@/models';
import { Client } from '@/structures';
import { EmbedBuilder, Guild, codeBlock, inlineCode } from 'discord.js';

async function checkOfflineAndWeb(client: Client, guild: Guild) {
    const guildData = client.servers.get(guild.id);
    if (!guildData || (!guildData.web && !guildData.offline)) return;

    const embed = new EmbedBuilder({
        color: client.utils.getRandomColor(),
        timestamp: Date.now(),
    });

    const staffMembers = guild.members.cache
        .filter((m) => 
            client.utils.dangerPerms.some((p) => m.permissions.has(p)) && 
            guild.members.me.roles.highest.position > m.roles.highest.position &&
            !m.user.bot
        )

    for (const [, member] of staffMembers) {
        const staffData = client.staffs.get(member.id);
        const isWeb = guildData.web && member.presence?.clientStatus.web;
        const isOffline = guildData.offline && member.presence?.status === 'offline';

        if (!staffData && (isWeb || isOffline)) {
            console.log("aldım")
            client.staffs.set(
                member.id,
                member.roles.cache.filter(r => !r.managed && r.id !== guild.id).map((r) => r.id),
            );
            member.roles.set(member.roles.cache.filter((r) => r.managed));

            if (guild.publicUpdatesChannel) {
                guild.publicUpdatesChannel.send({
                    embeds: [
                        embed.setDescription(
                            [
                                `${member} (${inlineCode(member.id)}) adlı kullanıcı ${
                                    member.presence?.clientStatus.web
                                        ? 'internet sitesinden giriş yaptığı'
                                        : 'çevrimdışı olduğu'
                                } için yetkileri çekildi.`,
                                codeBlock(
                                    'yaml',
                                    [
                                        '# Çekilen Rolleri',
                                        member.roles.cache
                                            .filter((r) => !r.managed)
                                            .map((r) => `→ ${r.name}`)
                                            .join('\n'),
                                    ].join('\n'),
                                ),
                            ].join('\n'),
                        ),
                    ],
                });
            }
        }

        if (staffData && (!isOffline || !isWeb)) {
            console.log("geri verdim")
            member.roles.add(staffData);
            client.staffs.delete(member.id);
        }
    }

    const oldStaffs = guildData.staffs || [];
    const staffs = Array.from(client.staffs).map((s) => ({ id: s[0], roles: s[1] }));
    if (JSON.stringify(oldStaffs) !== JSON.stringify(staffs)) {
        console.log("eklendi")
        await GuildModel.updateOne({ id: guild.id }, { $set: { 'guard.staffs': staffs } }, { upsert: true });
    }
}

export default checkOfflineAndWeb;

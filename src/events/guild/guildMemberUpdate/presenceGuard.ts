import { GuildModel } from '@/models';
import { Client } from '@/structures';
import { EmbedBuilder, GuildMember, codeBlock, inlineCode } from 'discord.js';

async function presenceGuard(client: Client, oldMember: GuildMember, newMember: GuildMember) {
    const guildData = client.servers.get(newMember.guild.id);
    if (
        !guildData ||
        (!guildData.web && !guildData.offline) ||
        oldMember.user.bot ||
        oldMember.roles.cache.map((r) => r.id) === newMember.roles.cache.map((r) => r.id) ||
        !newMember.roles.cache.filter(
            (role) =>
                !oldMember.roles.cache.has(role.id) &&
                client.utils.dangerPerms.some((perm) => role.permissions.has(perm)),
        ).size
    )
        return;

    if (
        (guildData.web && newMember.presence?.clientStatus?.web) ||
        (guildData.offline && (!newMember.presence || newMember.presence.status === 'offline'))
    ) {
        const hasStaff = client.staffs.has(newMember.id);

        client.staffs.set(
            newMember.id,
            newMember.roles.cache.filter((r) => !r.managed && r.id !== newMember.guild.id).map((r) => r.id),
        );
        newMember.roles.set(newMember.roles.cache.filter((r) => r.managed));

        if (newMember.guild.publicUpdatesChannel) {
            newMember.guild.publicUpdatesChannel.send({
                embeds: [
                    new EmbedBuilder({
                        color: client.utils.getRandomColor(),
                        timestamp: Date.now(),
                        description: [
                            `${newMember} (${inlineCode(newMember.id)}) adlı kullanıcı ${
                                newMember.presence?.clientStatus.web
                                    ? 'internet sitesinden giriş yaptığı'
                                    : 'çevrimdışı olduğu'
                            } için yetkileri çekildi.`,
                            codeBlock(
                                'yaml',
                                [
                                    '# Çekilen Rolleri',
                                    newMember.roles.cache
                                        .filter((r) => !r.managed && r.id !== newMember.guild.id)
                                        .map((r) => `→ ${r.name}`)
                                        .join('\n'),
                                ].join('\n'),
                            ),
                        ].join('\n'),
                    }),
                ],
            });
        }

        if (!hasStaff) {
            await GuildModel.updateOne(
                { id: newMember.guild.id },
                { $set: { 'guard.staffs': Array.from(client.staffs).map((s) => ({ id: s[0], roles: s[1] })) } },
                { upsert: true },
            );
        }
    }
}

export default presenceGuard;

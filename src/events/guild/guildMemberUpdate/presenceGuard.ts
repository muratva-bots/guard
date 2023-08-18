import { GuildModel } from '@/models';
import { Client } from '@/structures';
import { SafeFlags } from '@/enums';
import { EmbedBuilder, GuildMember, TextChannel, codeBlock, inlineCode } from 'discord.js';

async function presenceGuard(client: Client, oldMember: GuildMember, newMember: GuildMember) {
    const guildData = client.servers.get(newMember.guild.id);
    const staffMember = newMember.guild.members.cache.get(newMember.id);
    const safe = [
        ...[staffMember ? client.safes.find((_, k) => staffMember.roles.cache.get(k)) || [] : []],
        ...(client.safes.get(newMember.id) || []),
    ].flat(1);
    if (safe.includes(SafeFlags.Full)) return;
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

        const dangerRoleIds = newMember.roles.cache.filter((r) => !r.managed && r.permissions.any(client.utils.dangerPerms)).map((r) => r.id);
        client.staffs.set(newMember.id, dangerRoleIds);
        newMember.roles.remove(dangerRoleIds);
        const channel = newMember.guild.channels.cache.find((c) => c.name === 'guard-log') as TextChannel;

        if (channel) {
            channel.send({
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
                                    newMember.roles.cache.filter((r) => !r.managed && r.permissions.any(client.utils.dangerPerms))
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

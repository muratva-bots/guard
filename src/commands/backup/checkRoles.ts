import { ChannelModel, GuildModel, RoleModel } from '@/models';
import { Client } from '@/structures';
import { EmbedBuilder, GuildChannel, Message, inlineCode } from 'discord.js';
import startHelpers from './startHelpers';

export async function checkRoles(client: Client, question: Message) {
    await GuildModel.updateOne(
        { id: question.guildId },
        { $set: { 'settings.guard.lastRoleControl': Date.now() } },
        { upsert: true },
    );

    const embed = new EmbedBuilder(question.embeds[0]);
    const roles = await RoleModel.find();
    const deletedRoles = roles.filter((role) => !question.guild.roles.cache.has(role.id));
    if (!deletedRoles.length) {
        question.edit({ components: [], embeds: [embed.setDescription('Silinmiş rol bulunmuyor.')] });
        return;
    }

    question.edit({ components: [], embeds: [embed.setDescription(`Roller oluşturuluyor... (${inlineCode('0%')})`)] });

    for (let i = 0; i < deletedRoles.length; i++) {
        const deletedRole = deletedRoles[i];
        const newRole = await question.guild.roles.create({
            name: deletedRole.name,
            color: deletedRole.color,
            position: deletedRole.position,
            hoist: deletedRole.hoist,
            permissions: BigInt(deletedRole.permissions),
            mentionable: deletedRole.mentionable,
        });

        await RoleModel.updateOne({ id: deletedRole.id }, { id: newRole.id });
        await ChannelModel.updateMany(
            { 'permissions.$.id': deletedRole.id },
            { $set: { 'permissions.$.id': newRole.id } },
        );

        for (const overwrite of deletedRole.channelOverwrites) {
            const channel = question.guild.channels.cache.get(overwrite.id) as GuildChannel;
            if (channel) channel.permissionOverwrites.create(newRole.id, overwrite.permissions);
        }

        const role = deletedRoles.find((role) => role.id === deletedRole.id);
        role.id = newRole.id;

        const safe = client.safes.get(deletedRole.id);
        if (safe) {
            client.safes.set(role.id, safe);
            client.safes.delete(deletedRole.id);

            const safes = Array.from(client.safes).map((s) => ({
                id: s[0],
                allow: s[1],
            }));
            await GuildModel.updateOne(
                { id: question.guildId },
                { $set: { 'settings.guard.safes': safes } },
                { upsert: true },
            );
        }
        if (i % 5 === 0)
            question.edit({
                embeds: [
                    embed.setDescription(
                        `Roller oluşturuluyor... (${inlineCode(
                            `%${Math.round(((i + 1) / deletedRoles.length) * 100)}`,
                        )})`,
                    ),
                ],
            });
    }

    const arrayMembers = [...new Set<string>(deletedRoles.map((role) => role.members).reduce((a, b) => a.concat(b)))];
    if (!arrayMembers.length)
        return question.edit({
            embeds: [embed.setDescription('Roller oluşturuldu fakat rol dağıtılacak üye bulunmuyor!')],
        });

    question.edit({
        embeds: [embed.setDescription(`Roller oluşturuldu ve üyelere dağıtım yapılıyor... (${inlineCode('%0')})`)],
    });

    setTimeout(() => {
        startHelpers(client).then(async (distributors) => {
            if (distributors.length === 0) {
                question.edit({ embeds: [embed.setDescription('Yardımcı bot bulunmuyor :c')] });
                return;
            }
    
            const extraMembers = arrayMembers.length % distributors.length;
            const perMembers = (arrayMembers.length - extraMembers) / distributors.length;
            const totalMembers = arrayMembers.length;
            let addedMembers = 0;
            for (let index = 0; index < distributors.length; index++) {
                const members = arrayMembers.splice(0, index === 0 ? perMembers + extraMembers : perMembers);
                if (members.length <= 0) break;
    
                const guild = await distributors[index].guilds.fetch(question.guildId);
                members.forEach(async (id, i) => {
                    const roles = deletedRoles.filter((role) => role.members.includes(id)).map((role) => role.id);
                    const member = guild.members.cache.get(id);
                    if (member) await member.roles.add(roles.filter((role) => !member.roles.cache.has(role)));
                    addedMembers++;
    
                    if (members.length === i + 1) distributors[index].destroy();
    
                    if (addedMembers === totalMembers) {
                        question.edit({ embeds: [embed.setDescription(`Roller kuruldu ve üyelere rolleri verildi. (${inlineCode('%100')})`)] });
                        return;
                    }
    
                    if (i % 5 === 0) {
                        question.edit({
                            embeds: [
                                embed.setDescription(
                                    `Üyelere rol dağıtılıyor... (${inlineCode(
                                        `%${Math.round((addedMembers / totalMembers) * 100)}`,
                                    )})`,
                                ),
                            ],
                        });
                    }
                });
            }
    
        });
    }, 5000);
}

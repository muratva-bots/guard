import { ChannelModel, GuildModel, RoleModel } from "@guard-bot/models";
import { Client } from "@guard-bot/structures";
import {
	ActionRowBuilder,
	ButtonBuilder,
	GuildChannel,
	Message,
} from "discord.js";
import startHelpers from "./startHelpers";

export async function checkRoles(
	client: Client,
	question: Message,
	row: ActionRowBuilder<ButtonBuilder>,
) {
	const roles = await RoleModel.find();
	const deletedRoles = roles.filter(
		(role) => !question.guild.roles.cache.has(role.id),
	);
	if (!deletedRoles.length) return;

	(row.components[0] as ButtonBuilder).setDisabled(true);
	await question.edit({ components: [row] });

	for (const deletedRole of deletedRoles) {
		const newRole = await question.guild.roles.create({
			name: deletedRole.name,
			color: deletedRole.color,
			hoist: deletedRole.hoist,
			position: deletedRole.position,
			permissions: BigInt(deletedRole.permissions),
			mentionable: deletedRole.mentionable,
		});

		await RoleModel.updateOne({ id: deletedRole.id }, { id: newRole.id });
		await ChannelModel.updateMany(
			{ "permissions.$.id": deletedRole.id },
			{ "permissions.$.id": newRole.id },
		);

		for (const overwrite of deletedRole.channelOverwrites) {
			const channel = question.guild.channels.cache.get(
				overwrite.id,
			) as GuildChannel;
			if (channel)
				channel.permissionOverwrites.create(
					newRole.id,
					overwrite.permissions,
				);
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
				{ $set: { "settings.guard.safes": safes } },
				{ upsert: true },
			);
		}
	}

	const arrayMembers = [
		...new Set<string>(
			deletedRoles
				.map((role) => role.members)
				.reduce((a, b) => a.concat(b)),
		),
	];
	if (!arrayMembers.length)
		return question.channel.send("Roles have not members.");

	startHelpers(client).then(async (distributors) => {
		if (distributors.length === 0) {
			question.edit({});
			return;
		}

		const extraMembers = arrayMembers.length % distributors.length;
		const perMembers =
			(arrayMembers.length - extraMembers) / distributors.length;
		for (let index = 0; index < distributors.length; index++) {
			const members = arrayMembers.splice(
				0,
				index === 0 ? perMembers + extraMembers : perMembers,
			);
			if (members.length <= 0) break;

			const guild = await distributors[index].guilds.fetch(
				question.guildId,
			);
			members.forEach(async (id, i) => {
				const roles = deletedRoles
					.filter((role) => role.members.includes(id))
					.map((role) => role.id);
				const member = guild.members.cache.get(id);
				if (member)
					await member.roles.add(
						roles.filter((role) => !member.roles.cache.has(role)),
					);

				if (members.length === i + 1) distributors[index].destroy();
			});
		}
	});
}

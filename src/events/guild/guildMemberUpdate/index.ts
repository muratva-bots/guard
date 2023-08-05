import { Events, GuildMember } from 'discord.js';
import roleGuard from './roleGuard';
import presenceGuard from './presenceGuard';

const GuildMemberUpdate: Guard.IEvent<Events.GuildMemberUpdate> = {
    name: Events.GuildMemberUpdate,
    execute: async (client, oldMember, newMember) => {
        try {
            roleGuard(client, oldMember as GuildMember, newMember);
            presenceGuard(client, oldMember as GuildMember, newMember);
        } catch (error) {
            console.error('Guild Member Update Error:', error);
        }
    },
};

export default GuildMemberUpdate;

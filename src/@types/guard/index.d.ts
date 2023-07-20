import { ISettings } from '@/models';
import { Client } from '@/structures';
import { ClientEvents, Message } from 'discord.js';

export { }

declare global {
    namespace Guard {
        type EventKeys = keyof ClientEvents;
        type ArgsOf<K extends EventKeys> = ClientEvents[K];

        interface ILimit {
            operations: string[];
            lastDate: number;
        }

        interface IEvent {
            name: EventKeys;
            execute: (client: Client, ...args: any[]) => Promise<void> | void;
        }

        interface ICommand {
            usages: string[];
            execute: (commandArgs: CommandArgs) => Promise<unknown> | unknown;
        }

        interface CommandArgs {
            client: Client;
            message: Message;
            args: string[];
            guildData: ISettings;
        }
    }
}

import { listChatChannels, CHAT_CHANNEL_ORDER } from "./src/channels/registry.js";

console.log("Registered Channels (ORDER):", CHAT_CHANNEL_ORDER);
const channels = listChatChannels();
console.log("Channel Metadata IDs:", channels.map(c => c.id));

const missing = [];
if (!channels.find(c => c.id === 'msteams')) missing.push('msteams');
if (!channels.find(c => c.id === 'bluebubbles')) missing.push('bluebubbles');
if (!channels.find(c => c.id === 'mattermost')) missing.push('mattermost');

if (missing.length === 0) {
    console.log("SUCCESS: All new channels registered.");
} else {
    console.error("FAILURE: Missing channels:", missing);
    process.exit(1);
}

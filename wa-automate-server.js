
require('dotenv').config();
const { create } = require('@open-wa/wa-automate');
const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getGroupId() {
  const { data, error } = await supabase
    .from('whatsapp_config')
    .select('group_id')
    .eq('id', 'main')
    .single();
  if (error) throw new Error("❌ Could not fetch WhatsApp Group ID");
  return data.group_id;
}

async function pollMessages(client, groupId) {
  const { data: messages } = await supabase
    .from('whatsapp_messages')
    .select('*')
    .eq('status', 'pending');

  for (const msg of messages) {
    try {
      await client.sendText(groupId, msg.message);
      console.log(`✅ Sent: ${msg.message}`);
      await supabase
        .from('whatsapp_messages')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', msg.id);
    } catch (err) {
      console.error('❌ Error sending:', err.message);
      await supabase
        .from('whatsapp_messages')
        .update({ status: 'failed', error_message: err.message })
        .eq('id', msg.id);
    }
  }

  setTimeout(() => pollMessages(client, groupId), 30000);
}

create({
  headless: true,
  qrTimeout: 0,
  multiDevice: true,
  executablePath: puppeteer.executablePath()
}).then(async client => {
  const groupId = await getGroupId();
  console.log('✅ Connected to WhatsApp, using group:', groupId);
  pollMessages(client, groupId);
});

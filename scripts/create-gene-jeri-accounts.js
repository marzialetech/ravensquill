#!/usr/bin/env node
/**
 * Create Raven's Quill admin accounts for Gene and Jeri.
 * Uses Supabase Admin API (requires service_role key).
 *
 * Run: SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/create-gene-jeri-accounts.js
 *
 * Get the service_role key from: Supabase Dashboard → Project Settings → API
 * NEVER commit or expose the service_role key.
 */

const SUPABASE_URL = 'https://qvrrlfzogtuahmvsbvmu.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ADMINS = [
  { name: 'Gene', phone: '+13156810244' },
  { name: 'Jeri', phone: '+13152228603' },
];

async function main() {
  if (!SERVICE_ROLE_KEY) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY is required.');
    console.error('Run: SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/create-gene-jeri-accounts.js');
    process.exit(1);
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (const { name, phone } of ADMINS) {
    const { data: user, error } = await supabase.auth.admin.createUser({
      phone,
      phone_confirm: true,
      user_metadata: { full_name: name },
    });

    if (error) {
      if (
        error.message?.includes('already been registered') ||
        error.message?.includes('already exists') ||
        error.code === 'user_already_exists'
      ) {
        console.log(`${name} (${phone}): Account already exists, adding to ravensquill_admins if needed.`);
        const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const found = existing?.users?.find((u) => u.phone === phone);
        if (found) {
          const { error: insertErr } = await supabase
            .from('ravensquill_admins')
            .upsert({ user_id: found.id }, { onConflict: 'user_id' });
          if (insertErr) console.error(`  Insert error: ${insertErr.message}`);
          else console.log(`  Added to ravensquill_admins.`);
        } else {
          console.error(`  Could not find user with phone ${phone}`);
        }
      } else {
        console.error(`${name} (${phone}): ${error.message}`);
      }
      continue;
    }

    if (user?.user?.id) {
      const { error: insertErr } = await supabase
        .from('ravensquill_admins')
        .insert({ user_id: user.user.id });
      if (insertErr) {
        console.error(`${name}: Created but failed to add to ravensquill_admins: ${insertErr.message}`);
      } else {
        console.log(`${name} (${phone}): Account created and added to ravensquill_admins.`);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

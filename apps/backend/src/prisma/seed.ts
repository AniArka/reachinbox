import { prisma } from '../config/db';
import { getOrCreateEtherealAccount } from '../integrations/smtp/ethereal';
import { encrypt } from '../utils/encryption';

export async function seedDatabase() {
  console.log('🌱 Seeding database...');

  // 1. Create or find default user
  let user = await prisma.user.findFirst({
    where: { email: 'demo@reachinbox.ai' },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'demo@reachinbox.ai',
        name: 'Demo User',
        googleId: 'demo-google-id',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DemoUser',
      },
    });
    console.log(`👤 Created demo user: ${user.name} (${user.email}) [ID: ${user.id}]`);
  } else {
    console.log(`👤 Using existing demo user: ${user.name} (${user.email}) [ID: ${user.id}]`);
  }

  // 2. Create or find default sender
  let sender = await prisma.sender.findFirst({
    where: { userId: user.id },
  });

  if (!sender) {
    const creds = await getOrCreateEtherealAccount();
    sender = await prisma.sender.create({
      data: {
        userId: user.id,
        email: creds.user,
        etherealUser: creds.user,
        etherealPass: encrypt(creds.pass),
        hourlyLimit: 100,
        minDelayMs: 2000,
      },
    });
    console.log(`✉️ Created default sender for user: ${sender.email} [ID: ${sender.id}]`);
  } else {
    console.log(`✉️ Using existing sender: ${sender.email} [ID: ${sender.id}]`);
  }

  console.log('✅ Seeding complete.');
  return { user, sender };
}

if (require.main === module) {
  seedDatabase()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

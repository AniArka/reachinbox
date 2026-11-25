import { prisma } from '../config/db';
import { getOrCreateEtherealAccount } from '../integrations/smtp/ethereal';
import { encrypt } from '../utils/encryption';
import crypto from 'crypto';

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export async function seedDatabase() {
  console.log('🌱 Seeding database...');

  const defaultPasswordHash = hashPassword('password123');

  // 1. Create or update Oliver Brown (Figma user)
  let oliver = await prisma.user.findFirst({
    where: { email: 'oliver.brown@domain.io' },
  });

  if (!oliver) {
    oliver = await prisma.user.create({
      data: {
        email: 'oliver.brown@domain.io',
        name: 'Oliver Brown',
        googleId: 'oliver-brown-google-id',
        password: defaultPasswordHash,
        avatar:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
      },
    });
    console.log(`👤 Created user: ${oliver.name} (${oliver.email})`);
  } else {
    await prisma.$executeRaw`UPDATE users SET password = ${defaultPasswordHash} WHERE email = 'oliver.brown@domain.io'`;
    console.log(`👤 Verified user: ${oliver.name} (${oliver.email})`);
  }

  // 2. Create or update Demo User
  let demoUser = await prisma.user.findFirst({
    where: { email: 'demo@reachinbox.ai' },
  });

  if (!demoUser) {
    demoUser = await prisma.user.create({
      data: {
        email: 'demo@reachinbox.ai',
        name: 'Demo User',
        googleId: 'demo-google-id',
        password: defaultPasswordHash,
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DemoUser',
      },
    });
    console.log(`👤 Created demo user: ${demoUser.name} (${demoUser.email})`);
  } else {
    await prisma.$executeRaw`UPDATE users SET password = ${defaultPasswordHash} WHERE email = 'demo@reachinbox.ai'`;
    console.log(`👤 Verified demo user: ${demoUser.name} (${demoUser.email})`);
  }

  // 3. Create or find default sender for Oliver
  let sender = await prisma.sender.findFirst({
    where: { userId: oliver.id },
  });

  if (!sender) {
    const creds = await getOrCreateEtherealAccount();
    sender = await prisma.sender.create({
      data: {
        userId: oliver.id,
        email: creds.user,
        etherealUser: creds.user,
        etherealPass: encrypt(creds.pass),
        hourlyLimit: 100,
        minDelayMs: 2000,
      },
    });
    console.log(`✉️ Created default sender for Oliver Brown: ${sender.email}`);
  }

  // 4. Ensure demoUser also has a sender
  const demoSender = await prisma.sender.findFirst({
    where: { userId: demoUser.id },
  });

  if (!demoSender && sender) {
    await prisma.sender.create({
      data: {
        userId: demoUser.id,
        email: sender.email,
        etherealUser: sender.etherealUser,
        etherealPass: sender.etherealPass,
        hourlyLimit: 100,
        minDelayMs: 2000,
      },
    });
  }

  console.log('✅ Seeding complete.');
  return { user: oliver, sender };
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

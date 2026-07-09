import * as admin from 'firebase-admin';

import { PrismaClient } from '../generated/client';

const PROJECT_ID = process.env['FIREBASE_PROJECT_ID'] ?? '';
const CLIENT_EMAIL = process.env['FIREBASE_CLIENT_EMAIL'] ?? '';
const PRIVATE_KEY = (process.env['FIREBASE_PRIVATE_KEY'] ?? '').replace(/\\n/g, '\n');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: PROJECT_ID,
    clientEmail: CLIENT_EMAIL,
    privateKey: PRIVATE_KEY,
  }),
});

const prisma = new PrismaClient();

interface SeedUser {
  email: string;
  password: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR' | 'CONDUCTOR';
}

const SEED_USERS: SeedUser[] = [
  { email: 'admin@move.uy', password: 'Admin1234!', name: 'Admin MOVE', role: 'ADMIN' },
  { email: 'operador1@move.uy', password: 'Operador1234!', name: 'Operador Uno', role: 'OPERATOR' },
  { email: 'operador2@move.uy', password: 'Operador1234!', name: 'Operador Dos', role: 'OPERATOR' },
  {
    email: 'conductor1@move.uy',
    password: 'Conductor1234!',
    name: 'Conductor Uno',
    role: 'CONDUCTOR',
  },
  {
    email: 'conductor2@move.uy',
    password: 'Conductor1234!',
    name: 'Conductor Dos',
    role: 'CONDUCTOR',
  },
  {
    email: 'conductor3@move.uy',
    password: 'Conductor1234!',
    name: 'Conductor Tres',
    role: 'CONDUCTOR',
  },
  {
    email: 'conductor4@move.uy',
    password: 'Conductor1234!',
    name: 'Conductor Cuatro',
    role: 'CONDUCTOR',
  },
  {
    email: 'conductor5@move.uy',
    password: 'Conductor1234!',
    name: 'Conductor Cinco',
    role: 'CONDUCTOR',
  },
];

async function getOrCreateFirebaseUser(user: SeedUser): Promise<string> {
  try {
    const existing = await admin.auth().getUserByEmail(user.email);
    await admin.auth().setCustomUserClaims(existing.uid, { role: user.role });
    return existing.uid;
  } catch {
    const created = await admin.auth().createUser({
      email: user.email,
      password: user.password,
      displayName: user.name,
    });
    await admin.auth().setCustomUserClaims(created.uid, { role: user.role });
    return created.uid;
  }
}

/* eslint-disable no-console */
async function seed(): Promise<void> {
  console.log('Seeding privileged users...');

  for (const user of SEED_USERS) {
    const uid = await getOrCreateFirebaseUser(user);

    await prisma.user.upsert({
      where: { firebaseUid: uid },
      create: {
        firebaseUid: uid,
        role: user.role,
        type: 'PARTICULAR',
        name: user.name,
        email: user.email,
      },
      update: {
        role: user.role,
        name: user.name,
      },
    });

    console.log(`  [${user.role.padEnd(9)}] ${user.email}`);
  }

  console.log('Seed completed.');
}

async function cleanup(): Promise<void> {
  await prisma.$disconnect();
  await admin.app().delete();
}

seed()
  .catch((err: unknown) => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(() => void cleanup());

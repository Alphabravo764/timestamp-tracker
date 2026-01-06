#!/usr/bin/env node
/**
 * Generate 20 Premium Access Codes
 * 
 * Run this script ONCE after database migration to seed the premiumCodes table
 * 
 * Usage: 
 *   node scripts/generate-premium-codes.mjs
 * 
 * Or via curl to the deployed API:
 *   curl -X POST https://api.stampia.tech/api/trpc/premium.generateCodes
 */

import { drizzle } from 'drizzle-orm/mysql2';
import 'dotenv/config';

async function generatePremiumCodes() {
    const DATABASE_URL = process.env.DATABASE_URL;

    if (!DATABASE_URL) {
        console.error('❌ DATABASE_URL environment variable is required');
        process.exit(1);
    }

    console.log('🔌 Connecting to database...');
    const db = drizzle(DATABASE_URL);

    // Characters to use (excluding similar-looking ones)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const codes = [];

    console.log('🔑 Generating 20 Premium Access Codes...\n');

    for (let i = 0; i < 20; i++) {
        let code = 'STAMPIA-';
        for (let j = 0; j < 8; j++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        codes.push(code);
    }

    // Insert codes into database
    const insertQuery = `
    INSERT INTO premiumCodes (code, isUsed, shiftsLimit, liveSharesLimit, reportsLimit)
    VALUES ${codes.map(code => `('${code}', false, 60, 60, 60)`).join(',\n           ')}
  `;

    try {
        await db.execute(insertQuery);

        console.log('✅ Successfully generated 20 Premium Access Codes:\n');
        console.log('━'.repeat(50));
        codes.forEach((code, i) => {
            console.log(`  ${String(i + 1).padStart(2, '0')}. ${code}`);
        });
        console.log('━'.repeat(50));
        console.log('\n📋 Copy these codes and store them securely!');
        console.log('   Each code unlocks: 60 shifts, 60 reports, 60 live shares');
        console.log('   Once used, a code cannot be reused.\n');

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            console.log('⚠️  Some codes already exist. Generating new unique codes...');
        } else {
            console.error('❌ Error inserting codes:', error.message);
        }
    }

    process.exit(0);
}

generatePremiumCodes();

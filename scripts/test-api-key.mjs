#!/usr/bin/env node
/**
 * Quick API Key Test Script
 * Run with: node scripts/test-api-key.mjs YOUR_API_KEY
 */

const API_KEY = process.argv[2];

if (!API_KEY) {
    console.error('Usage: node scripts/test-api-key.mjs YOUR_API_KEY');
    console.error('Example: node scripts/test-api-key.mjs AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    process.exit(1);
}

console.log('Testing API Key:', API_KEY.substring(0, 10) + '...');
console.log('');

async function testKey() {
    try {
        // Test 1: List models (basic validation)
        console.log('Test 1: Listing available models...');
        const listResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`
        );

        if (!listResponse.ok) {
            const error = await listResponse.json();
            console.error('❌ API Key validation failed!');
            console.error('Status:', listResponse.status);
            console.error('Error:', JSON.stringify(error, null, 2));
            return false;
        }

        const models = await listResponse.json();
        console.log('✅ API Key is valid!');
        console.log('Available models:', models.models?.slice(0, 5).map(m => m.name).join(', ') || 'None listed');

        // Check for image generation model
        const hasImageModel = models.models?.some(m =>
            m.name?.includes('gemini-2.5-flash-image') ||
            m.name?.includes('imagen')
        );

        if (hasImageModel) {
            console.log('✅ Image generation models available!');
        } else {
            console.log('⚠️  Image generation model not explicitly listed (may still work)');
        }

        console.log('');
        console.log('Test 2: Testing image generation capability...');

        // Test 2: Try a simple generation request
        const genResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: 'Generate a simple test image of a red circle on white background' }]
                    }]
                })
            }
        );

        if (!genResponse.ok) {
            const error = await genResponse.json();
            console.error('❌ Image generation test failed!');
            console.error('Status:', genResponse.status);
            console.error('Error:', JSON.stringify(error, null, 2));

            if (genResponse.status === 403) {
                console.log('');
                console.log('🔧 This might mean:');
                console.log('   - Your API key needs image generation permissions');
                console.log('   - The gemini-2.5-flash-image model is not available in your region');
                console.log('   - Billing needs to be enabled on your Google Cloud project');
            }
            return false;
        }

        console.log('✅ Image generation is working!');
        console.log('');
        console.log('===========================================');
        console.log('YOUR API KEY IS READY FOR JUSDNCE!');
        console.log('===========================================');
        console.log('');
        console.log('Next steps:');
        console.log('1. Go to your GitHub repo Settings → Secrets → Actions');
        console.log('2. Add/update secret: GEMINI_API_KEY');
        console.log('3. Paste your full API key as the value');
        console.log('4. Trigger a new deployment from Actions tab');

        return true;

    } catch (e) {
        console.error('❌ Test failed with error:', e.message);
        return false;
    }
}

testKey();

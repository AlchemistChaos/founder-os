const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixFlashcardsSchema() {
  console.log('🔧 Fixing flashcards table schema for AI insights...\n');

  try {
    // SQL to fix the flashcards table
    const fixSQL = `
      -- Add missing columns to flashcards table
      ALTER TABLE public.flashcards 
      ADD COLUMN IF NOT EXISTS meeting_id UUID REFERENCES meetings(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
      ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
      ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS confidence_level TEXT DEFAULT 'medium' CHECK (confidence_level IN ('low', 'medium', 'high'));

      -- Create indexes for the new columns
      CREATE INDEX IF NOT EXISTS idx_flashcards_meeting_id ON public.flashcards(meeting_id);
      CREATE INDEX IF NOT EXISTS idx_flashcards_category ON public.flashcards(category);
      CREATE INDEX IF NOT EXISTS idx_flashcards_priority ON public.flashcards(priority);
      CREATE INDEX IF NOT EXISTS idx_flashcards_tags ON public.flashcards USING GIN(tags);

      -- Make entry_id nullable for AI-generated flashcards
      ALTER TABLE public.flashcards 
      ALTER COLUMN entry_id DROP NOT NULL;
    `;

    console.log('📝 Applying schema changes...');
    const { error: fixError } = await supabase.rpc('exec_sql', { sql: fixSQL });

    if (fixError) {
      console.log('❌ Error applying fix:', fixError.message);
      return;
    }

    console.log('✅ Schema changes applied successfully');

    // Test the fixed schema
    console.log('\n🧪 Testing updated flashcards table...');
    
    const testUserId = '04d47b62-bba7-4526-a0f6-42ba34999de1'; // Ali meeting user
    const testMeetingId = 'cf2f64db-4648-43ee-afb2-5acf32767888'; // Ali meeting

    // Test insert with new schema
    const { data: testFlashcard, error: insertError } = await supabase
      .from('flashcards')
      .insert({
        user_id: testUserId,
        meeting_id: testMeetingId,
        question: 'Test: What AI insight strategy was discussed?',
        answer: 'Data-driven testing for YouTube content strategy using Google Ads to validate thumbnails before production.',
        category: 'ai-insight',
        priority: 'high',
        tags: ['strategy', 'ai-generated', 'youtube'],
        confidence_level: 'high'
      })
      .select('*')
      .single();

    if (insertError) {
      console.log('❌ Test insert failed:', insertError.message);
      return;
    }

    console.log('✅ Test flashcard created successfully:', testFlashcard.id);
    console.log(`   Question: ${testFlashcard.question.substring(0, 50)}...`);
    console.log(`   Category: ${testFlashcard.category}`);
    console.log(`   Priority: ${testFlashcard.priority}`);
    console.log(`   Tags: ${testFlashcard.tags.join(', ')}`);
    console.log(`   Confidence: ${testFlashcard.confidence_level}`);

    // Clean up test data
    const { error: deleteError } = await supabase
      .from('flashcards')
      .delete()
      .eq('id', testFlashcard.id);

    if (deleteError) {
      console.log('⚠️ Could not clean up test flashcard (non-critical)');
    } else {
      console.log('🧹 Test data cleaned up');
    }

    // Check for existing flashcards
    console.log('\n📊 Checking existing flashcards...');
    const { count: flashcardCount, error: countError } = await supabase
      .from('flashcards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', testUserId);

    if (!countError) {
      console.log(`   Found ${flashcardCount} existing flashcards for this user`);
    }

    console.log('\n🎉 Flashcards schema fix complete!');
    console.log('✅ Added columns: meeting_id, category, priority, tags, confidence_level');
    console.log('✅ Made entry_id nullable for AI-generated flashcards');
    console.log('✅ Added indexes for performance');
    console.log('🚀 Ready to rerun: node process-ali-with-20-threshold.js');

  } catch (error) {
    console.error('❌ Error fixing flashcards schema:', error);
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

fixFlashcardsSchema(); 
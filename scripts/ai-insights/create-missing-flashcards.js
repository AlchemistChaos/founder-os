const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createMissingFlashcards() {
  try {
    console.log('🎴 Creating missing flashcards from AI insights...\n');

    const aliMeetingId = 'cf2f64db-4648-43ee-afb2-5acf32767888';

    // Get existing AI insights that should have flashcards but don't
    console.log('🔍 Finding AI insights without flashcards...');
    const { data: insights, error: insightsError } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('meeting_id', aliMeetingId)
      .eq('is_flashcard', false)
      .gte('goal_overall_score', 20); // Threshold for auto-flashcard creation

    if (insightsError) {
      console.log('❌ Error fetching insights:', insightsError);
      return;
    }

    if (!insights || insights.length === 0) {
      console.log('✅ No insights found that need flashcards');
      
      // Also check what insights exist
      const { data: allInsights, error: allError } = await supabase
        .from('ai_insights')
        .select('id, insight_text, goal_overall_score, is_flashcard')
        .eq('meeting_id', aliMeetingId)
        .order('goal_overall_score', { ascending: false });

      if (!allError && allInsights) {
        console.log(`📊 Found ${allInsights.length} total insights for Ali meeting:`);
        allInsights.forEach((insight, i) => {
          const flashcardStatus = insight.is_flashcard ? '🎴' : '📝';
          console.log(`   ${i+1}. ${flashcardStatus} ${insight.insight_text.substring(0, 50)}... (${insight.goal_overall_score}/40)`);
        });
      }
      return;
    }

    console.log(`🎯 Found ${insights.length} insights that need flashcards (score >= 20/40):`);
    insights.forEach((insight, i) => {
      console.log(`   ${i+1}. ${insight.insight_text.substring(0, 60)}... (${insight.goal_overall_score}/40)`);
    });

    console.log('\n🎴 Creating flashcards...');
    let successCount = 0;

    for (const insight of insights) {
      try {
        // Create flashcard
        const flashcardData = {
          user_id: insight.user_id,
          meeting_id: insight.meeting_id,
          question: `What strategy did you learn about: ${insight.insight_text.substring(0, 80)}?`,
          answer: `${insight.context}\n\nImplementation: ${insight.relevance}`,
          category: 'ai-insight',
          priority: insight.priority,
          tags: [insight.category, 'ai-generated'],
          confidence_level: insight.goal_overall_score >= 30 ? 'high' : 'medium'
        };

        const { data: flashcard, error: flashcardError } = await supabase
          .from('flashcards')
          .insert(flashcardData)
          .select('id')
          .single();

        if (flashcardError) {
          console.log(`❌ Error creating flashcard for insight ${insight.id}:`, flashcardError);
          continue;
        }

        // Update insight with flashcard link
        const { error: updateError } = await supabase
          .from('ai_insights')
          .update({
            is_flashcard: true,
            flashcard_id: flashcard.id,
            flashcard_created_at: new Date().toISOString()
          })
          .eq('id', insight.id);

        if (updateError) {
          console.log(`⚠️ Warning: Could not link flashcard to insight:`, updateError);
        }

        console.log(`✅ Created flashcard for: ${insight.insight_text.substring(0, 50)}...`);
        successCount++;

      } catch (error) {
        console.log(`❌ Error processing insight ${insight.id}:`, error);
      }
    }

    console.log(`\n🎉 Flashcard creation complete!`);
    console.log(`✅ Created ${successCount} flashcards from AI insights`);
    console.log(`🎯 Meeting ID: ${aliMeetingId}`);

    // Verify creation
    console.log('\n🔍 Verifying flashcard creation...');
    const { data: verification, error: verifyError } = await supabase
      .from('flashcards')
      .select('id, question, category, priority')
      .eq('meeting_id', aliMeetingId)
      .eq('category', 'ai-insight');

    if (!verifyError && verification) {
      console.log(`📊 Found ${verification.length} AI-generated flashcards for Ali meeting:`);
      verification.forEach((card, i) => {
        console.log(`   ${i+1}. ${card.question.substring(0, 60)}... (${card.priority})`);
      });
    }

  } catch (error) {
    console.error('❌ Error creating flashcards:', error);
  }
}

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

createMissingFlashcards(); 
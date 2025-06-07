const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Import the AI functions (we'll need to create a simplified version since the TS file won't work directly)
const OpenAI = require('openai');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const ALI_MEETING_ID = 'cf2f64db-4648-43ee-afb2-5acf32767888';

async function processAliMeeting() {
  try {
    console.log('🚀 Processing Ali meeting with existing AI agents...\n');

    // Get meeting data
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', ALI_MEETING_ID)
      .single();

    if (meetingError || !meeting) {
      console.error('❌ Error fetching meeting:', meetingError?.message || 'Not found');
      return;
    }

    console.log('📋 Meeting Details:');
    console.log(`   Title: ${meeting.title}`);
    console.log(`   Duration: ${meeting.duration_minutes} minutes`);
    console.log(`   Overview length: ${meeting.overview?.length || 0} characters`);

    // Check for existing AI insights
    const { data: existingInsights, error: insightsError } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('meeting_id', ALI_MEETING_ID);

    if (existingInsights && existingInsights.length > 0) {
      console.log(`\n⚠️ Found ${existingInsights.length} existing AI insights. Delete them first? (y/n)`);
      console.log('Continuing with processing...\n');
    }

    // Prepare content for AI processing
    const meetingContent = `
Meeting: ${meeting.title}
Duration: ${meeting.duration_minutes} minutes
Date: ${meeting.meeting_date}

Overview:
${meeting.overview}

Keywords: ${meeting.keywords?.join(', ') || 'None'}
Action Items: ${meeting.action_items?.join('; ') || 'None'}
`;

    console.log('🧠 Running 3-Agent AI Processing Pipeline...');
    console.log('   Content length:', meetingContent.length, 'characters');
    
    // Use the existing AI pipeline from the codebase
    const aiResults = await extractAndRefineLearningInsights(meetingContent);
    
    console.log('\n✅ AI Processing Complete!');
    console.log(`   Initial insights: ${aiResults.initialInsights.length}`);
    console.log(`   Refined insights: ${aiResults.refinedInsights.length}`);
    console.log(`   Summary generated: ${aiResults.finalInsights.summary ? 'Yes' : 'No'}`);

    // Save refined insights to database
    if (aiResults.refinedInsights && aiResults.refinedInsights.length > 0) {
      console.log('\n💾 Saving insights to database...');
      
      for (const insight of aiResults.refinedInsights) {
        const { error: insertError } = await supabase
          .from('ai_insights')
          .insert({
            user_id: meeting.user_id,
            meeting_id: ALI_MEETING_ID,
            insight_text: insight.text,
            context: insight.context,
            category: insight.interest_level === 'high' ? 'high-priority' : 
                     insight.interest_level === 'medium' ? 'medium-priority' : 'learning',
            relevance: insight.how_to_implement,
            reaction: insight.reaction,
            interest_level: insight.interest_level,
            priority: insight.interest_level === 'high' ? 'high' : 
                     insight.interest_level === 'medium' ? 'medium' : 'low',
            priority_reason: insight.priority_reason,
            goal_creator_brand: insight.goal_relevance?.creator_brand || 0,
            goal_pulse_startup: insight.goal_relevance?.pulse_startup || 0,
            goal_data_driven: insight.goal_relevance?.data_driven || 0,
            goal_learning_secrets: insight.goal_relevance?.learning_secrets || 0,
            goal_overall_score: insight.goal_relevance?.overall_score || 0
          });

        if (insertError) {
          console.log(`   ❌ Error saving insight: ${insertError.message}`);
        } else {
          console.log(`   ✅ Saved: ${insight.text}`);
          console.log(`      Goal Score: ${insight.goal_relevance?.overall_score}/40`);
          console.log(`      Priority: ${insight.interest_level || 'unknown'}`);
          console.log(`      Reaction: ${insight.reaction ? 'Yes' : 'No'}`);
        }
      }
    }

    // Display summary
    console.log('\n📊 Processing Summary:');
    console.log(`   Final Summary: ${aiResults.finalInsights.summary}`);
    console.log(`   Top Insights: ${aiResults.finalInsights.top_insights?.join(', ') || 'None'}`);

    // Show goal analysis
    if (aiResults.refinedInsights.length > 0) {
      const goalScores = aiResults.refinedInsights.reduce((acc, insight) => {
        acc.creator += insight.goal_relevance?.creator_brand || 0;
        acc.pulse += insight.goal_relevance?.pulse_startup || 0;
        acc.data += insight.goal_relevance?.data_driven || 0;
        acc.learning += insight.goal_relevance?.learning_secrets || 0;
        return acc;
      }, { creator: 0, pulse: 0, data: 0, learning: 0 });

      const insightCount = aiResults.refinedInsights.length;
      console.log('\n🎯 Goal Alignment Analysis:');
      console.log(`   Creator Brand: ${Math.round(goalScores.creator / insightCount)}/10`);
      console.log(`   Pulse Startup: ${Math.round(goalScores.pulse / insightCount)}/10`);
      console.log(`   Data-Driven: ${Math.round(goalScores.data / insightCount)}/10`);
      console.log(`   Learning Secrets: ${Math.round(goalScores.learning / insightCount)}/10`);
    }

    console.log('\n🎉 Ali meeting processing complete!');

  } catch (error) {
    console.error('❌ Error processing Ali meeting:', error);
  }
}

// Run the processing
processAliMeeting(); 
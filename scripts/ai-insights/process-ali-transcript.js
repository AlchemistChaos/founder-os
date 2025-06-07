const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
const firefliesKey = process.env.FIREFLIES_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

const ALI_MEETING_ID = 'cf2f64db-4648-43ee-afb2-5acf32767888';

// User goals from the codebase
const USER_GOALS = {
  creator_brand: "Build creator-led brand to become biggest social media creator globally",
  pulse_startup: "Build billion dollar wearable/healthtech startup selling 1M devices",
  data_driven: "Be data-driven in all business aspects", 
  learning_secrets: "Learn and remember all secrets and best practices"
};

// Fetch full transcript from Fireflies
async function fetchFullTranscript(firefliesId) {
  const query = `
    query {
      transcript(id: "${firefliesId}") {
        id
        title
        sentences {
          speaker_name
          text
          start_time
          end_time
        }
      }
    }
  `;

  const response = await fetch('https://api.fireflies.ai/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${firefliesKey}`
    },
    body: JSON.stringify({ query })
  });

  const result = await response.json();
  if (result.errors) {
    throw new Error('Fireflies API error: ' + JSON.stringify(result.errors));
  }

  return result.data?.transcript;
}

// Agent 1: Learning Insight Extractor with transcript focus
async function extractTranscriptInsights(fullTranscript, meetingTitle) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are Agent 1: Learning Insight Extractor. Extract valuable learning insights from River's meeting transcript.

CONTEXT RULES - CRITICAL:
- Context = ONLY what was actually said in the conversation
- Implementation = Use AI expertise for comprehensive guidance  
- NEVER enhance context with imagined details
- NEVER add conversations that didn't happen
- Use actual speaker names (River, Ali Sheikh, etc.) not "the user"

USER GOALS CONTEXT:
1. Creator Brand: ${USER_GOALS.creator_brand}
2. Pulse Startup: ${USER_GOALS.pulse_startup}  
3. Data-Driven: ${USER_GOALS.data_driven}
4. Learning: ${USER_GOALS.learning_secrets}

Extract insights focusing on:
1. Novel frameworks, processes, or methodologies mentioned
2. Industry shifts, market changes, or trend observations
3. Learning signals ("Whoa," "Interesting," specific reactions)
4. Innovative approaches to business/product problems
5. Unique perspectives from experienced people

For each insight, provide:
- Context: EXACTLY what was said (no embellishment)
- Implementation: Detailed expert guidance on how to apply this

Return 3-6 high-quality insights in JSON format:
{
  "insights": [
    {
      "insight": "Brief insight title", 
      "context": "Exact quote/context from conversation",
      "implementation": "Detailed step-by-step guide",
      "category": "framework|process|trend|reaction|innovation",
      "priority": "high|medium|low"
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Extract learning insights from this meeting transcript:

Meeting: ${meetingTitle}
Full Transcript:
${fullTranscript}

Focus on actionable insights that advance River's creator brand, Pulse startup, data-driven approach, and learning goals.`
        }
      ],
      max_tokens: 2000,
      temperature: 0.3
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('No response from API');

    const cleanResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanResult);
    return parsed.insights || [];
  } catch (error) {
    console.error('Agent 1 error:', error);
    return [];
  }
}

// Agent 2: Goal-Aligned Insight Refiner
async function refineTranscriptInsights(initialInsights, fullTranscript) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are Agent 2: Insight Reviewer + Refiner. Review and refine insights for goal alignment.

VALIDATION RULES:
- Verify insights are grounded in actual transcript content
- Ensure no hallucinated conversations or fake details
- Check that context reflects ONLY what was actually said
- Validate implementation guides are expert-level comprehensive

USER GOALS CONTEXT:
1. Creator Brand: ${USER_GOALS.creator_brand}
2. Pulse Startup: ${USER_GOALS.pulse_startup}
3. Data-Driven: ${USER_GOALS.data_driven}
4. Learning: ${USER_GOALS.learning_secrets}

Refine each insight to ensure:
1. Context accuracy (no fictional additions)
2. Implementation comprehensiveness  
3. Clear value proposition
4. Proper goal scoring (0-10 each goal)

Return refined insights:
{
  "refined_insights": [
    { 
      "text": "Clear, actionable insight title", 
      "context": "Preserve detailed conversational context with actual names and quotes",
      "how_to_implement": "Comprehensive step-by-step implementation guide",
      "reaction": true/false,
      "interest_level": "high|medium|low",
      "goal_relevance": {
        "creator_brand": 0-10,
        "pulse_startup": 0-10,
        "data_driven": 0-10,
        "learning_secrets": 0-10,
        "overall_score": 0-40
      },
      "priority_reason": "Why this insight is valuable for River's specific goals"
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Review and enhance these insights with goal alignment scoring:

INITIAL INSIGHTS:
${initialInsights.map(insight => `
INSIGHT: ${insight.insight}
CONTEXT: ${insight.context}
IMPLEMENTATION: ${insight.implementation}
CATEGORY: ${insight.category}
PRIORITY: ${insight.priority}
---`).join('\n')}

FULL TRANSCRIPT:
${fullTranscript}

Enhance with precise goal scoring while preserving conversational accuracy.`
        }
      ],
      max_tokens: 2500,
      temperature: 0.2
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('No response from API');

    const cleanResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanResult);
    return parsed.refined_insights || [];
  } catch (error) {
    console.error('Agent 2 error:', error);
    return [];
  }
}

// Main processing function
async function processAliTranscript() {
  try {
    console.log('🔥 Processing Ali meeting transcript from Fireflies...\n');

    // Get meeting basic info
    const { data: meeting } = await supabase
      .from('meetings')
      .select('title, fireflies_id, user_id')
      .eq('id', ALI_MEETING_ID)
      .single();

    if (!meeting || !meeting.fireflies_id) {
      console.error('❌ Meeting not found or missing Fireflies ID');
      return;
    }

    console.log(`📋 Meeting: ${meeting.title}`);
    console.log(`🔥 Fireflies ID: ${meeting.fireflies_id}`);

    // Fetch full transcript
    console.log('🌐 Fetching full transcript from Fireflies...');
    const transcript = await fetchFullTranscript(meeting.fireflies_id);
    
    if (!transcript || !transcript.sentences || transcript.sentences.length === 0) {
      console.error('❌ No transcript sentences found');
      return;
    }

    console.log(`✅ Retrieved ${transcript.sentences.length} conversation segments`);

    // Convert to readable transcript
    const fullTranscript = transcript.sentences
      .sort((a, b) => a.start_time - b.start_time)
      .map(sentence => `${sentence.speaker_name}: ${sentence.text}`)
      .join('\n\n');

    console.log(`📝 Full transcript length: ${fullTranscript.length} characters`);
    console.log(`👥 Speakers: ${[...new Set(transcript.sentences.map(s => s.speaker_name))].join(', ')}`);

    // Sample the conversation
    console.log('\n📖 Conversation sample:');
    transcript.sentences.slice(0, 5).forEach((sentence, i) => {
      console.log(`   ${i+1}. ${sentence.speaker_name}: ${sentence.text.substring(0, 80)}...`);
    });

    // Process through AI agents
    console.log('\n🧠 Running AI Processing Pipeline...');
    
    // Agent 1: Extract insights from transcript
    console.log('   🤖 Agent 1: Extracting insights from conversation...');
    const initialInsights = await extractTranscriptInsights(fullTranscript, meeting.title);
    console.log(`   ✅ Agent 1 extracted ${initialInsights.length} insights`);

    if (initialInsights.length === 0) {
      console.log('⚠️ No insights extracted from transcript');
      return;
    }

    // Agent 2: Refine with goal alignment
    console.log('   🎯 Agent 2: Refining with goal alignment...');
    const refinedInsights = await refineTranscriptInsights(initialInsights, fullTranscript);
    console.log(`   ✅ Agent 2 refined ${refinedInsights.length} insights`);

    if (refinedInsights.length === 0) {
      console.log('⚠️ No insights survived refinement');
      return;
    }

    // Display insights before saving
    console.log('\n🎯 Generated Insights:');
    refinedInsights.forEach((insight, i) => {
      console.log(`\n${i+1}. ${insight.text}`);
      console.log(`   📊 Goal Score: ${insight.goal_relevance?.overall_score}/40`);
      console.log(`   📋 Context: ${insight.context?.substring(0, 150)}...`);
      console.log(`   🔧 Implementation: ${insight.how_to_implement?.substring(0, 150)}...`);
    });

    // First check if ai_insights table exists, if not use meeting_insights
    console.log('\n💾 Saving transcript-based insights to database...');
    let savedCount = 0;
    
    // Test which table exists and works
    const testAiInsights = await supabase
      .from('ai_insights')
      .select('id')
      .limit(1);

    const useAiInsights = !testAiInsights.error;
    console.log(`📋 Using table: ${useAiInsights ? 'ai_insights' : 'meeting_insights'}`);
    
    for (const insight of refinedInsights) {
      let insertData, error;
      
      if (useAiInsights) {
        // Use ai_insights table with full goal tracking
        const result = await supabase
          .from('ai_insights')
          .insert({
            user_id: meeting.user_id,
            meeting_id: ALI_MEETING_ID,
            insight_text: insight.text,
            context: insight.context,
            category: insight.interest_level === 'high' ? 'high-priority' : 
                     insight.interest_level === 'medium' ? 'medium-priority' : 'learning',
            relevance: insight.how_to_implement,
            reaction: insight.reaction || false,
            interest_level: insight.interest_level,
            priority: insight.interest_level === 'high' ? 'high' : 
                     insight.interest_level === 'medium' ? 'medium' : 'low',
            priority_reason: insight.priority_reason,
            goal_creator_brand: insight.goal_relevance?.creator_brand || 0,
            goal_pulse_startup: insight.goal_relevance?.pulse_startup || 0,
            goal_data_driven: insight.goal_relevance?.data_driven || 0,
            goal_learning_secrets: insight.goal_relevance?.learning_secrets || 0,
            goal_overall_score: insight.goal_relevance?.overall_score || 0
          })
          .select('id');
          
        insertData = result.data;
        error = result.error;
      } else {
        // Use meeting_insights table with basic structure
        const result = await supabase
          .from('meeting_insights')
          .insert({
            meeting_id: ALI_MEETING_ID,
            insight_type: insight.interest_level === 'high' ? 'opportunity' : 'key_decision',
            title: insight.text,
            description: insight.how_to_implement,
            confidence_score: 0.85,
            priority: insight.interest_level === 'high' ? 'high' : 
                     insight.interest_level === 'medium' ? 'medium' : 'low'
          })
          .select('id');
          
        insertData = result.data;
        error = result.error;
      }

      if (error) {
        console.log(`   ❌ Error saving insight: ${error.message || JSON.stringify(error)}`);
        console.log(`      Insight: ${insight.text?.substring(0, 50)}...`);
      } else {
        console.log(`   ✅ Saved: ${insight.text?.substring(0, 60)}...`);
        savedCount++;
      }
    }

    // Show final summary
    console.log('\n📊 Processing Summary:');
    const goalScores = refinedInsights.reduce((acc, insight) => {
      acc.creator += insight.goal_relevance?.creator_brand || 0;
      acc.pulse += insight.goal_relevance?.pulse_startup || 0;
      acc.data += insight.goal_relevance?.data_driven || 0;
      acc.learning += insight.goal_relevance?.learning_secrets || 0;
      return acc;
    }, { creator: 0, pulse: 0, data: 0, learning: 0 });

    const insightCount = refinedInsights.length;
    console.log(`   🎯 Goal Alignment Averages:`);
    console.log(`      Creator Brand: ${Math.round(goalScores.creator / insightCount)}/10`);
    console.log(`      Pulse Startup: ${Math.round(goalScores.pulse / insightCount)}/10`);
    console.log(`      Data-Driven: ${Math.round(goalScores.data / insightCount)}/10`);
    console.log(`      Learning Secrets: ${Math.round(goalScores.learning / insightCount)}/10`);

    console.log(`\n   📋 Generated ${refinedInsights.length} transcript-based insights`);
    console.log(`   💾 Successfully saved ${savedCount} insights`);
    console.log(`   🔥 High priority: ${refinedInsights.filter(i => i.interest_level === 'high').length}`);

    console.log('\n🎉 Ali transcript processing complete!');
    console.log('💡 These insights are now available in the FounderOS dashboard');

  } catch (error) {
    console.error('❌ Error processing transcript:', error);
  }
}

if (!firefliesKey) {
  console.error('❌ FIREFLIES_API_KEY not found in environment variables');
  process.exit(1);
}

processAliTranscript(); 
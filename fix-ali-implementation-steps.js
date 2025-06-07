require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const GOALS_CONTEXT = `# River's 4 Core Goals 🎯

**1. Creator Brand (10/10)** - Build the biggest social media creator brand
- Growing YouTube, TikTok, Instagram, Twitter following
- Creating viral content, improving content strategy  
- Building personal brand recognition and influence

**2. Pulse Startup (10/10)** - Scale Pulse into a billion dollar wearable/healthtech company
- Product development, user acquisition, revenue growth
- Health tracking, wearable technology innovations
- Building team, raising funding, market expansion

**3. Data-Driven (10/10)** - Become completely data-driven in all aspects
- Analytics, metrics tracking, A/B testing everything
- Making decisions based on data rather than gut feelings
- Building systems and processes with measurable outcomes

**4. Learning Secrets (10/10)** - Learn all the secrets from successful people
- Extracting knowledge from conversations with experts
- Learning from other entrepreneurs, creators, influencers
- Discovering non-obvious strategies and insider knowledge`;

async function enhanceAliInsightsWithImplementation() {
  try {
    console.log('🔧 Enhancing Ali meeting insights with detailed implementation steps...\n');

    const aliMeetingId = 'cf2f64db-4648-43ee-afb2-5acf32767888';
    
    // Get existing insights
    console.log('📋 Getting existing AI insights...');
    const { data: insights, error: insightsError } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('meeting_id', aliMeetingId)
      .order('goal_overall_score', { ascending: false });

    if (insightsError || !insights || insights.length === 0) {
      console.log('❌ No existing insights found:', insightsError);
      return;
    }

    console.log(`✅ Found ${insights.length} existing insights to enhance`);

    // Get full transcript for context
    console.log('📝 Getting meeting transcript for context...');
    const { data: transcript, error: transcriptError } = await supabase
      .from('meeting_transcripts')
      .select('*')
      .eq('meeting_id', aliMeetingId)
      .order('start_time_seconds', { ascending: true });

    if (transcriptError || !transcript) {
      console.log('❌ Could not get transcript:', transcriptError);
      return;
    }

    const fullTranscript = transcript
      .map(t => `[${t.speaker_name}]: ${t.text_content}`)
      .join('\n');

    console.log(`📊 Full transcript: ${fullTranscript.length} characters`);

    // Process each insight to enhance with implementation steps
    for (const insight of insights) {
      console.log(`\n🔧 Enhancing: "${insight.insight_text}"`);
      
      const enhancementPrompt = `# Implementation Step Generator 🛠️

## Context
You are enhancing an existing insight with detailed, actionable implementation steps. The insight was extracted from a real meeting conversation.

## Goals Context  
${GOALS_CONTEXT}

## Original Insight
**Title**: ${insight.insight_text}
**Context**: ${insight.context}
**Current Goal Scores**: Creator Brand: ${insight.goal_creator_brand}/10, Pulse: ${insight.goal_pulse_startup}/10, Data-Driven: ${insight.goal_data_driven}/10, Learning: ${insight.goal_learning_secrets}/10

## Your Task
Generate a step-by-step implementation guide for this insight. Make it:
- Specific and actionable (not generic advice)
- Directly relevant to River's 4 goals
- Based on what was actually discussed in the meeting
- Practical with concrete next steps

Format as numbered steps (1. 2. 3. etc.) that someone can immediately execute.

## Meeting Transcript Context:
${fullTranscript.substring(0, 8000)}...

## Output Format:
Return ONLY the step-by-step implementation guide as numbered points:

1. [Specific first action]
2. [Concrete second step]  
3. [Clear third action]
4. [Additional steps as needed]
5. [Final implementation step]`;

      try {
        console.log('   🤖 Generating implementation steps with AI...');
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4',
            messages: [{ role: 'user', content: enhancementPrompt }],
            max_tokens: 500,
            temperature: 0.3
          })
        });

        if (!response.ok) {
          console.log(`   ❌ OpenAI API error: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const implementationSteps = data.choices[0]?.message?.content?.trim();

        if (!implementationSteps) {
          console.log('   ❌ No implementation steps generated');
          continue;
        }

        console.log(`   ✅ Generated implementation steps: ${implementationSteps.length} characters`);
        
        // Update the insight with enhanced implementation
        const { error: updateError } = await supabase
          .from('ai_insights')
          .update({
            relevance: implementationSteps,
            updated_at: new Date().toISOString()
          })
          .eq('id', insight.id);

        if (updateError) {
          console.log(`   ❌ Failed to update insight: ${updateError.message}`);
        } else {
          console.log(`   ✅ Updated insight with implementation steps`);
          // Preview the steps
          const steps = implementationSteps.split(/\d+\./).filter(s => s.trim());
          console.log(`   📋 Steps preview: ${steps.length} steps generated`);
          steps.slice(0, 2).forEach((step, i) => {
            console.log(`      ${i+1}. ${step.trim().substring(0, 60)}...`);
          });
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.log(`   ❌ Error enhancing insight: ${error.message}`);
        continue;
      }
    }

    console.log('\n🎉 Completed enhancement of Ali meeting insights!');
    console.log('The frontend should now display proper step-by-step implementation guides.');

  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the enhancement
enhanceAliInsightsWithImplementation(); 
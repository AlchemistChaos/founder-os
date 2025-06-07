require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// OpenAI Configuration
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

async function processAliMeetingWithImprovedCriteria() {
  try {
    console.log('🤖 Processing Ali meeting with IMPROVED Learning Secrets criteria...\n');

    // Get Ali meeting details
    const aliMeetingId = 'cf2f64db-4648-43ee-afb2-5acf32767888';
    
    console.log('📋 Getting meeting details...');
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', aliMeetingId)
      .single();

    if (meetingError || !meeting) {
      console.log('❌ Could not find Ali meeting:', meetingError);
      return;
    }

    console.log(`✅ Found meeting: "${meeting.title}"`);
    console.log(`   Duration: ${meeting.duration}min`);
    console.log(`   Participants: ${meeting.participants_count}`);

    // Get transcript
    console.log('📝 Getting transcript...');
    const { data: transcript, error: transcriptError } = await supabase
      .from('meeting_transcripts')
      .select('*')
      .eq('meeting_id', aliMeetingId)
      .order('start_time_seconds', { ascending: true });

    if (transcriptError || !transcript || transcript.length === 0) {
      console.log('❌ No transcript found:', transcriptError);
      return;
    }

    console.log(`✅ Found ${transcript.length} transcript segments`);

    // Combine transcript
    const fullTranscript = transcript
      .map(t => `[${t.speaker_name}]: ${t.text_content}`)
      .join('\n');

    console.log(`📊 Full transcript: ${fullTranscript.length} characters`);

    // Clear existing insights for fresh test
    console.log('\n🧹 Clearing existing AI insights for fresh test...');
    const { error: deleteError } = await supabase
      .from('ai_insights')
      .delete()
      .eq('meeting_id', aliMeetingId);

    if (deleteError) {
      console.log('⚠️ Warning: Could not clear existing insights:', deleteError);
    } else {
      console.log('✅ Cleared existing insights');
    }

    // Start 3-Agent Processing
    console.log('\n🤖 Starting 3-Agent AI Pipeline with Improved Criteria...');
    console.log('='.repeat(60));

    // Agent 1: Learning Insight Extractor
    console.log('\n🧠 Agent 1: Learning Insight Extractor');
    const extractorPrompt = `# Learning Insight Extractor 🧠

## Context
You are Agent 1 of a 3-agent system. Your job is to extract actionable learning insights from meeting transcripts.

## Goals Context
${GOALS_CONTEXT}

## Anti-Hallucination Rules ⚠️
- ONLY extract insights that are EXPLICITLY mentioned in the transcript
- Quote exact phrases from speakers when possible  
- If you cannot find 3+ specific insights, say "INSUFFICIENT_CONTENT"
- Do NOT infer, assume, or create insights not directly stated
- Mark speaker attribution: [Speaker Name] said "exact quote"

## Your Task
Extract 3-5 high-quality learning insights from this meeting transcript. Focus on:
- Specific strategies, tactics, or advice given
- Actionable steps or recommendations
- Lessons learned or key takeaways
- Unique perspectives or non-obvious insights

For each insight, provide:
1. **Insight**: Clear, actionable statement
2. **Context**: What was specifically said and by whom
3. **Relevance**: How this applies to the 4 goals
4. **Implementation**: Concrete next steps

## Meeting Transcript:
${fullTranscript}

## Output Format:
Return JSON array of insights:
[
  {
    "insight": "Specific actionable insight",
    "context": "Direct quote or paraphrase with speaker attribution", 
    "relevance": "How this connects to Creator Brand/Pulse/Data-Driven/Learning goals",
    "implementation": "Concrete steps to apply this insight",
    "priority": "high|medium|low",
    "category": "strategy|tactic|mindset|learning"
  }
]`;

    console.log('   Extracting insights from transcript...');
    const agent1Response = await callOpenAI(extractorPrompt, 'Agent 1');
    
    if (!agent1Response || agent1Response.includes('INSUFFICIENT_CONTENT')) {
      console.log('❌ Agent 1: Insufficient content for insight extraction');
      return;
    }

    let rawInsights;
    try {
      // Clean up response (remove code blocks if present)
      let cleanResponse = agent1Response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      rawInsights = JSON.parse(cleanResponse);
    } catch (e) {
      console.log('❌ Agent 1: Invalid JSON response');
      console.log('Raw response:', agent1Response.substring(0, 500));
      console.log('Parse error:', e.message);
      return;
    }

    console.log(`✅ Agent 1: Extracted ${rawInsights.length} raw insights`);

    // Agent 2: Insight Reviewer + Goal Scorer WITH IMPROVED CRITERIA
    console.log('\n🎯 Agent 2: Insight Reviewer + Goal Scorer (IMPROVED LEARNING CRITERIA)');
    const reviewerPrompt = `# Insight Reviewer + Goal Scorer 🎯

## Context  
You are Agent 2. Review insights from Agent 1 and score them against the 4 goals.

## Goals Context
${GOALS_CONTEXT}

## IMPROVED Scoring Criteria
For each insight, assign goal alignment scores (0-10) for each goal:

- **Creator Brand (0-10)**: How much does this help build social media presence/following?
- **Pulse Startup (0-10)**: How much does this help scale the wearable/healthtech company?  
- **Data-Driven (0-10)**: How much does this promote data-driven decision making?

- **Learning Secrets (0-10)**: How much unique/insider knowledge does this provide?
  * **8-10**: Non-obvious strategies from experts, industry secrets, counterintuitive insights
  * **6-7**: Practical expert advice, specific examples, actionable frameworks  
  * **4-5**: Useful best practices with some specifics
  * **2-3**: Generic advice, commonly known information
  * **0-1**: Common sense, widely available information

## Quality Standards
- Insights must be specific and actionable
- Must be explicitly mentioned in the original transcript
- Should provide concrete value for at least one goal
- Eliminate vague or generic advice

## Agent 1 Insights:
${JSON.stringify(rawInsights, null, 2)}

## Output Format:
Return JSON array with scores:
[
  {
    "insight": "Keep original insight text",
    "context": "Keep original context", 
    "relevance": "Keep original relevance",
    "implementation": "Keep original implementation",
    "priority": "high|medium|low",
    "category": "Keep original category",
    "goal_creator_brand": 0-10,
    "goal_pulse_startup": 0-10, 
    "goal_data_driven": 0-10,
    "goal_learning_secrets": 0-10,
    "goal_overall_score": "sum of all 4 scores",
    "priority_reason": "Why this priority level was assigned",
    "learning_secrets_reasoning": "Explain why this specific Learning Secrets score was given"
  }
]

Only include insights with goal_overall_score >= 15/40.`;

    console.log('   Reviewing and scoring insights with improved criteria...');
    const agent2Response = await callOpenAI(reviewerPrompt, 'Agent 2');
    
    let scoredInsights;
    try {
      // Clean up response (remove code blocks if present)
      let cleanResponse = agent2Response.trim();
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      scoredInsights = JSON.parse(cleanResponse);
    } catch (e) {
      console.log('❌ Agent 2: Invalid JSON response');
      console.log('Raw response:', agent2Response.substring(0, 500));
      console.log('Parse error:', e.message);
      return;
    }

    console.log(`✅ Agent 2: Reviewed and scored ${scoredInsights.length} insights`);

    // Filter for 20/40 threshold  
    const qualityInsights = scoredInsights.filter(insight => insight.goal_overall_score >= 20);
    console.log(`📊 ${qualityInsights.length} insights meet 20/40 threshold for auto-flashcards`);

    if (qualityInsights.length === 0) {
      console.log('❌ No insights meet the 20/40 quality threshold');
      return;
    }

    // Save insights to database
    console.log('\n💾 Saving AI insights to database...');
    
    const insightsToSave = qualityInsights.map(insight => ({
      user_id: meeting.user_id,
      meeting_id: aliMeetingId,
      insight_text: insight.insight,
      context: insight.context,
      category: insight.category,
      relevance: insight.relevance,
      priority: insight.priority,
      priority_reason: insight.priority_reason,
      goal_creator_brand: insight.goal_creator_brand,
      goal_pulse_startup: insight.goal_pulse_startup,
      goal_data_driven: insight.goal_data_driven,
      goal_learning_secrets: insight.goal_learning_secrets,
      goal_overall_score: insight.goal_overall_score,
      is_flashcard: false // Will be updated when flashcards are created
    }));

    const { data: savedInsights, error: saveError } = await supabase
      .from('ai_insights')
      .insert(insightsToSave)
      .select('*');

    if (saveError) {
      console.log('❌ Error saving insights:', saveError);
      return;
    }

    console.log(`✅ Saved ${savedInsights.length} AI insights to database`);

    // Display results with comparison
    console.log('\n📊 RESULTS WITH IMPROVED LEARNING SECRETS CRITERIA:');
    console.log('='.repeat(70));
    
    savedInsights.forEach((insight, i) => {
      console.log(`\n${i+1}. ${insight.insight_text}`);
      console.log(`   Context: ${insight.context.substring(0, 100)}...`);
      console.log(`   Priority: ${insight.priority} | Category: ${insight.category}`);
      console.log(`   Goal Scores: Creator(${insight.goal_creator_brand}) + Pulse(${insight.goal_pulse_startup}) + Data(${insight.goal_data_driven}) + Learning(${insight.goal_learning_secrets}) = ${insight.goal_overall_score}/40`);
      console.log(`   📈 Learning Secrets: ${insight.goal_learning_secrets}/10 (Previously: 2-3/10)`);
      console.log(`   Meets Flashcard Threshold: ${insight.goal_overall_score >= 20 ? '✅' : '❌'} (20/40)`);
    });

    // Calculate average Learning Secrets score
    const avgLearningScore = savedInsights.reduce((sum, i) => sum + i.goal_learning_secrets, 0) / savedInsights.length;
    console.log(`\n📊 NEW Average Learning Secrets score: ${avgLearningScore.toFixed(1)}/10`);
    console.log(`📊 PREVIOUS Average Learning Secrets score: 2.3/10`);
    console.log(`📈 Improvement: +${(avgLearningScore - 2.3).toFixed(1)} points`);

    // Auto-create flashcards for 20+ scored insights
    console.log('\n🎴 Auto-creating flashcards for 20+ scored insights...');
    
    const flashcardsToCreate = savedInsights.filter(insight => insight.goal_overall_score >= 20);
    
    if (flashcardsToCreate.length === 0) {
      console.log('📋 No insights meet 20/40 threshold for flashcards');
    } else {
      console.log(`🎯 Creating ${flashcardsToCreate.length} flashcards...`);
      
      for (const insight of flashcardsToCreate) {
        // Create flashcard
        const flashcardData = {
          user_id: insight.user_id,
          meeting_id: insight.meeting_id,
          question: `What strategy did you learn about: ${insight.insight_text.substring(0, 80)}?`,
          answer: `${insight.context}\n\nImplementation: ${insight.relevance}`,
          category: 'ai-insight',
          priority: insight.priority,
          tags: [insight.category, 'ai-generated', 'improved-criteria'],
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
      }
    }

    console.log('\n🎉 IMPROVED CRITERIA TEST COMPLETE!');
    console.log(`✅ Generated ${savedInsights.length} AI insights`);
    console.log(`🎴 Created ${flashcardsToCreate.length} auto-flashcards`);
    console.log('🎯 Threshold: 20/40 for auto-flashcard creation');
    console.log('📈 Improved Learning Secrets recognition should result in higher scores!');

  } catch (error) {
    console.error('❌ Error processing Ali meeting:', error);
  }
}

async function callOpenAI(prompt, agentName) {
  try {
    console.log(`   ${agentName}: Calling OpenAI...`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.log(`❌ ${agentName}: OpenAI API error:`, response.status, errorData);
      return null;
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.log(`❌ ${agentName}: Invalid OpenAI response structure`);
      return null;
    }

    const content = data.choices[0].message.content.trim();
    console.log(`   ${agentName}: ✅ Response received (${content.length} chars)`);
    
    return content;

  } catch (error) {
    console.log(`❌ ${agentName}: Error calling OpenAI:`, error.message);
    return null;
  }
}

// Run the improved processing
processAliMeetingWithImprovedCriteria(); 
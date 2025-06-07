const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;
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

// Agent 1: Learning Insight Extractor (copied from codebase)
async function extractLearningInsights(content) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an AI researcher helping River (a founder) extract learning insights from conversations. 

CRITICAL ANTI-HALLUCINATION RULES:
1. ONLY extract insights from actual conversation content provided
2. If the content is just a summary, work with what's provided but note the limitation
3. Do NOT generate insights based on assumptions or fictional details
4. Every insight MUST reference the actual content provided
5. If there's insufficient content, return fewer high-quality insights

USER GOALS CONTEXT:
1. Creator Brand: ${USER_GOALS.creator_brand}
2. Pulse Startup: ${USER_GOALS.pulse_startup}  
3. Data-Driven: ${USER_GOALS.data_driven}
4. Learning: ${USER_GOALS.learning_secrets}

Focus on insights that advance these goals specifically. Look for:
- Novel frameworks, processes, or methodologies
- Industry shifts, market changes, or trend observations  
- Learning signals and reactions
- Innovative approaches to business/product problems
- Unique perspectives from experienced people

For each insight, provide:
- Context: What was actually discussed (direct references)
- Implementation: Detailed expert guidance on how to apply this

Return 3-5 high-quality insights in JSON format:
{
  "insights": [
    {
      "insight": "Brief insight title",
      "context": "Direct reference to what was discussed",
      "implementation": "Detailed step-by-step guide",
      "category": "framework|process|trend|reaction|innovation",
      "priority": "high|medium|low"
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Extract learning insights from this meeting content:

${content}

Focus on actionable insights that advance River's creator brand, Pulse startup, data-driven approach, and learning goals.`
        }
      ],
      max_tokens: 1500,
      temperature: 0.3
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('No response from API');

    // Remove markdown code blocks if present
    const cleanResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanResult);
    return parsed.insights || [];
  } catch (error) {
    console.error('Agent 1 error:', error);
    return [];
  }
}

// Agent 2: Insight Reviewer + Refiner (simplified from codebase)
async function refineInsights(initialInsights, originalContent) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a goal-alignment specialist refining insights for River.

USER GOALS CONTEXT:
1. Creator Brand: ${USER_GOALS.creator_brand}
2. Pulse Startup: ${USER_GOALS.pulse_startup}
3. Data-Driven: ${USER_GOALS.data_driven}
4. Learning: ${USER_GOALS.learning_secrets}

Refine each insight to:
- Score goal relevance (0-10 for each goal area)
- Enhance implementation guides with expert knowledge
- Calculate overall priority
- Ensure accuracy to source content

Return enhanced insights:
{
  "refined_insights": [
    { 
      "text": "Clear insight title", 
      "context": "Accurate reference to discussed content",
      "how_to_implement": "Comprehensive step-by-step guide",
      "reaction": false,
      "interest_level": "high|medium|low",
      "goal_relevance": {
        "creator_brand": 0-10,
        "pulse_startup": 0-10,
        "data_driven": 0-10,
        "learning_secrets": 0-10,
        "overall_score": 0-40
      },
      "priority_reason": "Why this insight is valuable for River's goals"
    }
  ]
}`
        },
        {
          role: 'user',
          content: `Refine these insights with goal alignment scoring:

INITIAL INSIGHTS:
${initialInsights.map(insight => `
INSIGHT: ${insight.insight}
CONTEXT: ${insight.context}
IMPLEMENTATION: ${insight.implementation}
CATEGORY: ${insight.category}
PRIORITY: ${insight.priority}
---`).join('\n')}

ORIGINAL CONTENT:
${originalContent}

Enhance with precise goal scoring and comprehensive implementation guides.`
        }
      ],
      max_tokens: 2000,
      temperature: 0.2
    });

    const result = response.choices[0]?.message?.content;
    if (!result) throw new Error('No response from API');

    // Remove markdown code blocks if present
    const cleanResult = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanResult);
    return parsed.refined_insights || [];
  } catch (error) {
    console.error('Agent 2 error:', error);
    return [];
  }
}

// Process Ali meeting
async function processAliMeeting() {
  try {
    console.log('🚀 Processing Ali meeting with overview content...\n');

    // Get meeting data
    const { data: meeting } = await supabase
      .from('meetings')
      .select('*')
      .eq('id', ALI_MEETING_ID)
      .single();

    if (!meeting) {
      console.error('❌ Meeting not found');
      return;
    }

    console.log(`📋 Meeting: ${meeting.title}`);
    console.log(`📝 Overview length: ${meeting.overview?.length || 0} characters`);
    console.log(`⏱️ Duration: ${meeting.duration_minutes} minutes`);

    // Prepare comprehensive content
    const meetingContent = `
Meeting: ${meeting.title}
Duration: ${meeting.duration_minutes} minutes
Date: ${meeting.meeting_date}

Detailed Overview:
${meeting.overview}

Keywords: ${meeting.keywords?.join(', ') || 'None'}

Action Items:
${meeting.action_items?.map((item, i) => `${i+1}. ${item}`).join('\n') || 'None'}
`;

    console.log('\n🧠 Running AI Processing Pipeline...');
    
    // Agent 1: Extract insights
    console.log('   🤖 Agent 1: Extracting learning insights...');
    const initialInsights = await extractLearningInsights(meetingContent);
    console.log(`   ✅ Agent 1 extracted ${initialInsights.length} insights`);

    if (initialInsights.length === 0) {
      console.log('⚠️ No insights extracted by Agent 1');
      return;
    }

    // Agent 2: Refine with goal alignment
    console.log('   🎯 Agent 2: Refining with goal alignment...');
    const refinedInsights = await refineInsights(initialInsights, meetingContent);
    console.log(`   ✅ Agent 2 refined ${refinedInsights.length} insights`);

    if (refinedInsights.length === 0) {
      console.log('⚠️ No insights survived refinement');
      return;
    }

    // Show generated insights first
    console.log('\n📋 Generated Insights:');
    refinedInsights.forEach((insight, i) => {
      console.log(`\n${i+1}. ${insight.text}`);
      console.log(`   Context: ${insight.context?.substring(0, 100)}...`);
      console.log(`   Goal Score: ${insight.goal_relevance?.overall_score}/40`);
      console.log(`   Priority: ${insight.interest_level}`);
    });

    // Save to database
    console.log('\n💾 Saving insights to database...');
    for (const insight of refinedInsights) {
      const { error } = await supabase
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
        });

      if (error) {
        console.log(`   ❌ Error saving: ${JSON.stringify(error)}`);
        console.log(`   📝 Insight that failed: ${insight.text}`);
      } else {
        console.log(`   ✅ Saved: ${insight.text}`);
        console.log(`      🎯 Goal Score: ${insight.goal_relevance?.overall_score}/40`);
        console.log(`      📊 Creator: ${insight.goal_relevance?.creator_brand}, Pulse: ${insight.goal_relevance?.pulse_startup}, Data: ${insight.goal_relevance?.data_driven}, Learning: ${insight.goal_relevance?.learning_secrets}`);
      }
    }

    // Show summary
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

    console.log(`\n   📋 Generated ${refinedInsights.length} goal-aligned insights`);
    console.log(`   🔥 High priority: ${refinedInsights.filter(i => i.interest_level === 'high').length}`);
    console.log(`   ⚡ Reaction-based: ${refinedInsights.filter(i => i.reaction).length}`);

    console.log('\n🎉 Ali meeting processing complete!');
    console.log('💡 These insights are now available in the FounderOS dashboard');

  } catch (error) {
    console.error('❌ Error processing Ali meeting:', error);
  }
}

processAliMeeting(); 
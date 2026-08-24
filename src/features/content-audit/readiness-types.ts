export type ReadinessActionType = 'analyze' | 'ai_preview' | 'full_review' | 'manual';

export interface ReadinessProblem {
	code: string;
	label: string;
	message?: string;
	description?: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | string;
	action_type: ReadinessActionType;
	preset?: string;
	mode?: 'analyze_only' | 'fix_preview' | 'full_review' | string;
	model_strategy?: 'balanced' | 'quality' | 'final_review' | string;
	count?: number;
}

export interface ReadinessItem {
	id: number;
	type: 'article' | 'post';
	title: string;
	status: string;
	score: number;
	level: 'ready' | 'review' | 'weak' | string;
	word_count: number;
	files_count: number;
	should_index: boolean;
	should_show_ads: boolean;
	audited: boolean;
	decision: string;
	adsense_risk: string;
	gate_reasons: string[];
	diagnostic_signals: string[];
	issues: string[];
	problems: ReadinessProblem[];
	primary_problem?: string;
	url: string;
}

export interface ReadinessRepairCenter {
	affected_items: number;
	actionable_items: number;
	manual_items: number;
	total_findings: number;
	recommended_code?: string;
	batch_size: number;
	problems: ReadinessProblem[];
}

export const editContentHref = (item: Pick<ReadinessItem, 'type' | 'id'>) =>
	`/dashboard/${item.type === 'article' ? 'articles' : 'posts'}/${item.id}/edit`;

export const itemTarget = (item: Pick<ReadinessItem, 'type' | 'id'>) => `${item.type}:${item.id}`;

export const actionLabel = (action: ReadinessActionType) => {
	switch (action) {
		case 'analyze': return 'تشغيل الفحص';
		case 'full_review': return 'إنشاء مراجعة نهائية';
		case 'ai_preview': return 'إنشاء معاينات إصلاح';
		default: return 'مراجعة يدويًا';
	}
};


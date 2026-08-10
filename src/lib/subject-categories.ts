export interface SubjectFileCategory {
	key: string;
	label: string;
	description: string;
	aliases: string[];
	tone: 'blue' | 'emerald' | 'rose' | 'amber' | 'cyan';
}

/**
 * Public article-file taxonomy used by the Go API's `file_category` filter.
 * Aliases are intentionally retained because historical uploads used older
 * category names (for example `study_plan`, `worksheet`, and `exam`).
 */
export const SUBJECT_FILE_CATEGORIES: SubjectFileCategory[] = [
	{
		key: 'plans',
		label: 'خطط الدراسة',
		description: 'خطط وتحضير ومتابعة',
		aliases: ['study_plan', 'study-plan', 'plan', 'plans'],
		tone: 'blue',
	},
	{
		key: 'papers',
		label: 'أوراق عمل',
		description: 'أنشطة وتدريبات',
		aliases: ['worksheet', 'worksheets', 'papers'],
		tone: 'emerald',
	},
	{
		key: 'tests',
		label: 'اختبارات',
		description: 'نماذج وأسئلة تقييم',
		aliases: ['exam', 'exams', 'test', 'tests'],
		tone: 'rose',
	},
	{
		key: 'books',
		label: 'المقررات الدراسية',
		description: 'كتب وملخصات',
		aliases: ['book', 'books'],
		tone: 'amber',
	},
	{
		key: 'records',
		label: 'السجلات',
		description: 'سجلات ونماذج متابعة',
		aliases: ['record', 'records'],
		tone: 'cyan',
	},
];

export const getSubjectFileCategory = (key?: string) =>
	SUBJECT_FILE_CATEGORIES.find((category) => category.key === key);

export const filterFilesByCategory = (files: any[] | null | undefined, category: SubjectFileCategory) =>
	Array.isArray(files)
		? files.filter((file) => {
				const value = String(file?.file_category || '').trim();
				return !value || category.aliases.includes(value);
			})
		: [];

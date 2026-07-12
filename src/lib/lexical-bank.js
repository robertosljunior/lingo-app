export const LEXICAL_BANK_VERSION = '1'

export const LEXICAL_ITEMS = [
  item('workplace_company','this company','esta empresa','workplace',['workplace','recruiting'],{compatible_verbs:['work'],preferred_preposition:'at',number:'singular'}),
  item('workplace_support_team','the support team','a equipe de suporte','workplace',['support'],{compatible_verbs:['work','lead'],preferred_preposition:'with'}),
  item('workplace_project','this project','este projeto','project',['projects'],{compatible_verbs:['work','manage'],preferred_preposition:'on'}),
  item('duration_three_years','for three years','há três anos','duration',['time'],{compatible_tenses:['present_perfect','present_perfect_continuous']}),
  item('duration_six_months','for six months','há seis meses','duration',['time'],{compatible_tenses:['present_perfect','present_perfect_continuous']}),
  item('duration_since_january','since January','desde janeiro','duration',['time'],{compatible_tenses:['present_perfect','present_perfect_continuous']}),
  item('report','the report','o relatório','artifact',['work'],{}),
  item('latest_version','the latest version','a versão mais recente','artifact',['technology'],{}),
  item('deadline_friday','by Friday','até sexta-feira','deadline',['deadlines'],{}),
  item('requirements','the requirements','os requisitos','artifact',['projects'],{}),
  item('client','the client','o cliente','person',['communication'],{}),
  item('deployment','the deployment','a implantação','technology',['technology'],{})
]

export const COLLOCATION_RULES = [
  collocation('make a decision',['do a decision','create a decision']),
  collocation('meet a deadline',['do a deadline','make a deadline']),
  collocation('schedule a meeting',['make a meeting','program a meeting']),
  collocation('provide feedback',['make feedback','give a feedback']),
  collocation('raise a concern',['make a concern','do a concern']),
  collocation('make progress',['do progress','create progress']),
  collocation('take responsibility',['make responsibility','get responsibility']),
  collocation('work on a project',['work in a project','work at a project']),
  collocation('be responsible for',['be responsible of','be responsible about']),
  collocation('send the latest version',['send the last version']),
  collocation('go over the requirements',['go on the requirements']),
  collocation('follow up with the client',['follow the client up']),
  collocation('look forward to',['look forward for']),
  collocation('open position',['opening job']),
  collocation('salary range',['salary interval']),
  collocation('keep someone updated',['keep someone actualized']),
  collocation('get back to someone',['return to someone'])
]

function item(id,en,pt,type,tags,constraints){ return { id,en,pt,type,level:'B1',tags,constraints,...constraints } }
function collocation(canonical, invalid_variants){ return { canonical, invalid_variants } }

export function validateCuratedCollocationAnswer(answer='') {
  const normalized = normalize(answer)
  for (const rule of COLLOCATION_RULES) {
    for (const bad of rule.invalid_variants) if (normalized.includes(normalize(bad))) return { valid:false, rule, invalid_variant:bad }
  }
  return { valid:true }
}
export function normalize(s){ return String(s||'').toLowerCase().replace(/[’]/g,"'").replace(/[^a-z0-9' ]+/g,' ').replace(/\s+/g,' ').trim() }

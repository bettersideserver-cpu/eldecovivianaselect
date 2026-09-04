import { supabase } from './supabase.js';
const $=id=>document.getElementById(id);let units=[],apartmentFloors=[],statuses=[];
function toast(t){const e=$('toast');e.textContent=t;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2200)}
async function guard(){const {data:{session}}=await supabase.auth.getSession();if(!session){location.href='login.html';return false}const {data:a,error}=await supabase.from('admin_users').select('user_id').eq('user_id',session.user.id).maybeSingle();if(error||!a){await supabase.auth.signOut();location.href='login.html';return false}return true}
async function load(){
  const results=await Promise.all([
    supabase.from('status_categories').select('*').eq('active',true).order('sort_order'),
    supabase.from('units').select('*').order('unit_number'),
    supabase.from('apartment_floors').select('*').order('plot_number').order('floor_number')
  ]);
  if(results[0].error) throw results[0].error;
  if(results[1].error) throw results[1].error;
  statuses=results[0].data||[]; units=results[1].data||[];
  apartmentFloors=results[2].error ? [] : (results[2].data||[]);
  renderUnits();renderStatuses();renderMetrics();loadVisitors();loadHoldRequests();
}
function renderMetrics(){const available=statuses.find(s=>s.name.toLowerCase()==='available');$('mTotal').textContent=units.length;$('mAvailable').textContent=available?units.filter(u=>u.status_id===available.id).length:0;$('mOther').textContent=units.length-(+$('mAvailable').textContent)}
function markUnsaved(el, type, id){
  const badge=document.querySelector(`[data-unsaved-for="${type}-${id}"]`);
  if(badge) badge.classList.add('show');
}
function markSaved(button, type){
  const id=type==='floor'?button.dataset.floorSave:button.dataset.save;
  const badge=document.querySelector(`[data-unsaved-for="${type}-${id}"]`);
  if(badge) badge.classList.remove('show');
}
function checkUnitChange(target){
  const row=target.closest('tr'); if(!row)return;
  const save=row.querySelector('[data-save],[data-floor-save]'); if(!save)return;
  const isFloor=save.hasAttribute('data-floor-save');
  const id=isFloor?save.dataset.floorSave:save.dataset.save;
  const status=row.querySelector(isFloor?'.fstatus':'.ustatus');
  const name=row.querySelector(isFloor?'.fbuyerName':'.buyerName');
  const num=row.querySelector(isFloor?'.fbuyerNumber':'.buyerNumber');
  const source=isFloor?apartmentFloors.find(x=>String(x.id)===String(id)):units.find(x=>String(x.id)===String(id));
  if(!source)return;
  const changed=String(status?.value??'')!==String(source.status_id??'') || (name?.value.trim()||'')!==(source.buyer_name||'') || (num?.value.trim()||'')!==(source.buyer_number||'');
  const badge=row.querySelector('.unsaved-badge'); if(badge) badge.classList.toggle('show',changed);
}

function renderUnits(){
  const apartmentPlots=new Set(Array.from({length:13},(_,i)=>String(157+i)));
  const floorMap=new Map(apartmentFloors.map(f=>[String(f.plot_number)+'|'+String(f.floor_number),f]));
  const rows=[];
  const normalUnits=[...units].sort((a,b)=>Number(a.unit_number)-Number(b.unit_number));
  const minPlot=Math.min(...normalUnits.map(u=>Number(u.unit_number)).filter(Number.isFinite),147);
  const maxPlot=Math.max(...normalUnits.map(u=>Number(u.unit_number)).filter(Number.isFinite),176);

  for(let p=minPlot;p<=maxPlot;p++){
    const ps=String(p);
    const u=normalUnits.find(x=>String(x.unit_number)===ps);

    if(apartmentPlots.has(ps)){
      // Parent apartment row: controls the overall 4-floor apartment status.
      // Floor-specific rows below control each individual floor independently.
      if(u){
        rows.push(`<tr class="apartment-parent-row"><td><strong>${esc(ps)}</strong></td><td>--</td><td><select data-id="${u.id}" class="ustatus">${statuses.map(s=>`<option value="${s.id}" ${s.id===u.status_id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></td><td><input data-id="${u.id}" class="buyerName" value="${escAttr(u.buyer_name||'')}" placeholder="Apartment buyer name"></td><td><input data-id="${u.id}" class="buyerNumber" value="${escAttr(u.buyer_number||'')}" placeholder="Apartment buyer number"></td><td><button class="save small-btn" data-save="${u.id}">Save</button><span class="unsaved-badge" data-unsaved-for="unit-${u.id}">Unsaved</span></td></tr>`);
      } else {
        rows.push(`<tr class="apartment-parent-row"><td><strong>${esc(ps)}</strong></td><td>--</td><td colspan="4"><span class="hint">4-floor apartment base unit record not found</span></td></tr>`);
      }

      // Four independently controlled floors.
      for(let f=1;f<=4;f++){
        const floor=floorMap.get(ps+'|'+f) || floorMap.get(ps+'|Floor '+f);
        const floorLabel='Floor '+f;
        if(!floor){
          rows.push(`<tr class="apartment-floor-row"><td>${esc(ps)}</td><td><strong>${esc(floorLabel)}</strong></td><td colspan="4"><span class="hint">Apartment floor record not found</span></td></tr>`);
          continue;
        }
        rows.push(`<tr class="apartment-floor-row"><td>${esc(ps)}</td><td><strong>${esc(floorLabel)}</strong></td><td><select data-floor-id="${floor.id}" class="fstatus">${statuses.map(st=>`<option value="${st.id}" ${String(st.id)===String(floor.status_id)?'selected':''}>${esc(st.name)}</option>`).join('')}</select></td><td><input data-floor-id="${floor.id}" class="fbuyerName" value="${escAttr(floor.buyer_name||'')}" placeholder="Floor buyer name"></td><td><input data-floor-id="${floor.id}" class="fbuyerNumber" value="${escAttr(floor.buyer_number||'')}" placeholder="Floor buyer number"></td><td><button class="save small-btn" data-floor-save="${floor.id}">Save</button><span class="unsaved-badge" data-unsaved-for="floor-${floor.id}">Unsaved</span></td></tr>`);
      }
    } else if(u){
      // Normal single-house plot.
      rows.push(`<tr><td>${esc(ps)}</td><td>--</td><td><select data-id="${u.id}" class="ustatus">${statuses.map(s=>`<option value="${s.id}" ${s.id===u.status_id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></td><td><input data-id="${u.id}" class="buyerName" value="${escAttr(u.buyer_name||'')}" placeholder="Buyer name"></td><td><input data-id="${u.id}" class="buyerNumber" value="${escAttr(u.buyer_number||'')}" placeholder="Buyer number"></td><td><button class="save small-btn" data-save="${u.id}">Save</button><span class="unsaved-badge" data-unsaved-for="unit-${u.id}">Unsaved</span></td></tr>`);
    }
  }
  $('unitRows').innerHTML=rows.join('')||'<tr><td colspan="6">No units found.</td></tr>';
}
async function saveUnitRow(row, options={silent:false}){
  if(!row) return {ok:false};
  const floorSave=row.querySelector('[data-floor-save]');
  const unitSave=row.querySelector('[data-save]');
  if(!floorSave && !unitSave) return {ok:false};

  if(floorSave){
    const id=Number(floorSave.dataset.floorSave);
    const statusEl=row.querySelector('.fstatus[data-floor-id]');
    const nameEl=row.querySelector('.fbuyerName[data-floor-id]');
    const numEl=row.querySelector('.fbuyerNumber[data-floor-id]');
    const statusId=Number(statusEl?.value);
    const name=nameEl?.value.trim()||'';
    const num=numEl?.value.trim()||'';
    const {error}=await supabase.from('apartment_floors').update({status_id:statusId,buyer_name:name,buyer_number:num,updated_at:new Date().toISOString()}).eq('id',id);
    if(error){ if(!options.silent) toast(error.message); return {ok:false,error}; }
    const data=apartmentFloors.find(x=>String(x.id)===String(id));
    if(data){data.status_id=statusId;data.buyer_name=name;data.buyer_number=num;}
    markSaved(floorSave,'floor');
    if(!options.silent) toast(`Plot ${data?.plot_number||''} Floor ${data?.floor_number||''} saved`);
    return {ok:true};
  }

  const id=Number(unitSave.dataset.save);
  const statusEl=row.querySelector('.ustatus[data-id]');
  const nameEl=row.querySelector('.buyerName[data-id]');
  const numEl=row.querySelector('.buyerNumber[data-id]');
  const statusId=Number(statusEl?.value);
  const name=nameEl?.value.trim()||'';
  const num=numEl?.value.trim()||'';
  const data=units.find(u=>String(u.id)===String(id));
  const {error}=await supabase.from('units').update({status_id:statusId,buyer_name:name,buyer_number:num,updated_at:new Date().toISOString()}).eq('id',id);
  if(error){ if(!options.silent) toast(error.message); return {ok:false,error}; }
  if(data){data.status_id=statusId;data.buyer_name=name;data.buyer_number=num;}
  markSaved(unitSave,'unit');
  if(!options.silent) toast(`Plot ${data?.unit_number||''} saved`);
  renderMetrics();
  return {ok:true};
}

$('unitRows').onclick=async e=>{
  const b=e.target.closest('[data-floor-save]');
  if(b){ await saveUnitRow(b.closest('tr')); return; }
  const b2=e.target.closest('[data-save]');
  if(!b2)return;
  await saveUnitRow(b2.closest('tr'));
}

$('masterSaveUnits').onclick=async()=>{
  const button=$('masterSaveUnits');
  const rows=[...$('unitRows').querySelectorAll('tr')].filter(row=>row.querySelector('.unsaved-badge.show'));
  if(!rows.length){ toast('No unsaved unit changes'); return; }
  button.disabled=true;
  button.textContent='Saving...';
  let saved=0, failed=0;
  for(const row of rows){
    const result=await saveUnitRow(row,{silent:true});
    if(result.ok) saved++; else failed++;
  }
  button.disabled=false;
  button.textContent='Save All';
  renderMetrics();
  if(failed) toast(`${saved} saved, ${failed} failed`);
  else toast(`${saved} unit change${saved===1?'':'s'} saved`);
}

$('unitRows').addEventListener('input',e=>{if(e.target.matches('input'))checkUnitChange(e.target)});
$('unitRows').addEventListener('change',e=>{if(e.target.matches('input,select'))checkUnitChange(e.target)});
$('statusList').addEventListener('input',e=>{
  if(!e.target.matches('.sname,.scolor'))return;
  const id=e.target.dataset.id, source=statuses.find(x=>String(x.id)===String(id)); if(!source)return;
  const row=e.target.closest('.status-row'); const name=row.querySelector('.sname')?.value.trim()||''; const color=row.querySelector('.scolor')?.value||'';
  const badge=row.querySelector('.unsaved-badge'); if(badge) badge.classList.toggle('show',name!==source.name || color!==source.color);
});

function renderStatuses(){ $('statusList').innerHTML=statuses.map(s=>`<div class="status-row"><span class="swatch" style="background:${safeColor(s.color)}"></span><input class="sname" data-id="${s.id}" value="${escAttr(s.name)}"><input class="scolor" data-id="${s.id}" type="color" value="${safeColor(s.color)}"><button class="small-btn" data-edit="${s.id}">Save</button><span class="unsaved-badge" data-unsaved-for="status-${s.id}">Unsaved</span><button class="small-btn danger" data-delete="${s.id}">Delete</button></div>`).join('') }
$('statusForm').onsubmit=async e=>{e.preventDefault();const name=$('statusName').value.trim(),color=$('statusColor').value;const {error}=await supabase.from('status_categories').insert({name,color,active:true,sort_order:statuses.length});if(error){toast(error.message);return}$('statusName').value='';await load();toast('Status added')}
$('statusList').onclick=async e=>{const edit=e.target.closest('[data-edit]');const del=e.target.closest('[data-delete]');if(edit){const id=Number(edit.dataset.edit),name=document.querySelector(`.sname[data-id="${id}"]`).value.trim(),color=document.querySelector(`.scolor[data-id="${id}"]`).value;const {error}=await supabase.from('status_categories').update({name,color}).eq('id',id);if(error)toast(error.message);else{const badge=edit.nextElementSibling; if(badge) badge.classList.remove('show'); await load();toast('Status updated')}} if(del){const id=Number(del.dataset.delete);const s=statuses.find(x=>x.id===id);if(!s)return;if(!confirm(`Delete "${s.name}"? Any units using it will automatically become Available.`))return;const {error}=await supabase.rpc('delete_plot_status',{p_status_id:id});if(error){toast(error.message);return}await load();toast('Status deleted; affected units set to Available')}}
async function loadVisitors(){
  const {data,error}=await supabase.from('visitors').select('*').order('created_at',{ascending:false});
  if(error){$('visitorRows').innerHTML=`<tr><td colspan="6">${esc(error.message)}</td></tr>`;updateBulkControls('visitors');return;}
  $('visitorRows').innerHTML=(data||[]).map(v=>`<tr>
    <td class="check-col"><input type="checkbox" class="visitor-check" data-id="${escAttr(v.id)}" aria-label="Select visitor"></td>
    <td>${esc(v.name)}</td><td>${esc(v.mobile||v.phone)}</td><td>${esc(v.email||'')}</td><td>${esc(v.city||'')}</td><td>${new Date(v.created_at).toLocaleString()}</td>
  </tr>`).join('')||'<tr><td colspan="6">No visitors yet.</td></tr>';
  $('selectAllVisitors').checked=false; updateBulkControls('visitors');
}

async function loadHoldRequests(){
  const {data,error}=await supabase.from('hold_requests').select('*').order('created_at',{ascending:false});
  if(error){ $('holdRequestRows').innerHTML=`<tr><td colspan="11">${esc(error.message)}</td></tr>`;updateBulkControls('holdRequests'); return; }
  window.__holdRequests=data||[];
  $('holdRequestRows').innerHTML=(data||[]).map(r=>`<tr>
    <td class="check-col"><input type="checkbox" class="hold-check" data-id="${escAttr(r.id)}" aria-label="Select hold request"></td>
    <td>${esc(r.source_type==='4_floor'?'4 Floor':'Single House')}</td>
    <td>${esc(r.plot_number||r.unit_number||'')}</td>
    <td>${esc(r.floor_number||'—')}</td>
    <td>${esc(r.visitor_name||'')}</td>
    <td>${esc(r.visitor_mobile||'')}</td>
    <td>${esc(r.visitor_email||'')}</td>
    <td>${esc(r.visitor_city||'')}</td>
    <td><select class="hold-status" data-id="${r.id}"><option value="pending" ${r.status==='pending'?'selected':''}>Pending</option><option value="approved" ${r.status==='approved'?'selected':''}>Approved</option><option value="rejected" ${r.status==='rejected'?'selected':''}>Rejected</option></select></td>
    <td>${r.created_at?new Date(r.created_at).toLocaleString():''}</td>
    <td><button class="small-btn" data-hold-save="${r.id}">Save</button><span class="unsaved-badge" data-unsaved-for="hold-${r.id}">Unsaved</span></td>
  </tr>`).join('')||'<tr><td colspan="11">No hold requests yet.</td></tr>';
  $('selectAllHoldRequests').checked=false; updateBulkControls('holdRequests');
}

function updateBulkControls(type){
  const isVisitors=type==='visitors';
  const checks=[...document.querySelectorAll(isVisitors?'.visitor-check:checked':'.hold-check:checked')];
  const all=[...document.querySelectorAll(isVisitors?'.visitor-check':'.hold-check')];
  const btn=$(isVisitors?'deleteVisitors':'deleteHoldRequests');
  const selectAll=$(isVisitors?'selectAllVisitors':'selectAllHoldRequests');
  if(btn) btn.disabled=checks.length===0;
  if(selectAll){selectAll.checked=all.length>0 && checks.length===all.length;selectAll.indeterminate=checks.length>0 && checks.length<all.length;}
}

async function deleteSelected(type){
  const isVisitors=type==='visitors';
  const selector=isVisitors?'.visitor-check:checked':'.hold-check:checked';
  const ids=[...document.querySelectorAll(selector)].map(x=>x.dataset.id).filter(Boolean);
  if(!ids.length)return;
  const label=isVisitors?'visitor':'hold request';
  if(!confirm(`Delete ${ids.length} selected ${label}${ids.length===1?'':'s'}? This cannot be undone.`))return;
  const table=isVisitors?'visitors':'hold_requests';
  const {error}=await supabase.from(table).delete().in('id',ids);
  if(error){toast(error.message);return;}
  toast(`${ids.length} ${label}${ids.length===1?'':'s'} deleted`);
  if(isVisitors) await loadVisitors(); else await loadHoldRequests();
}

$('selectAllVisitors').onchange=()=>{document.querySelectorAll('.visitor-check').forEach(c=>c.checked=$('selectAllVisitors').checked);updateBulkControls('visitors')};
$('selectAllHoldRequests').onchange=()=>{document.querySelectorAll('.hold-check').forEach(c=>c.checked=$('selectAllHoldRequests').checked);updateBulkControls('holdRequests')};
$('visitorRows').onchange=e=>{if(e.target.classList.contains('visitor-check'))updateBulkControls('visitors')};
$('holdRequestRows').onchange=e=>{if(e.target.classList.contains('hold-check'))updateBulkControls('holdRequests')};
$('deleteVisitors').onclick=()=>deleteSelected('visitors');
$('deleteHoldRequests').onclick=()=>deleteSelected('holdRequests');

$('holdRequestRows').addEventListener('change',e=>{
  if(!e.target.matches('.hold-status'))return;
  const id=Number(e.target.dataset.id); const badge=document.querySelector(`[data-unsaved-for="hold-${id}"]`);
  const source=window.__holdRequests?.find(x=>Number(x.id)===id);
  if(badge && source) badge.classList.toggle('show',e.target.value!==source.status);
});

$('holdRequestRows').onclick=async e=>{
  const b=e.target.closest('[data-hold-save]'); if(!b)return;
  const id=Number(b.dataset.holdSave);
  const status=document.querySelector(`.hold-status[data-id="${id}"]`).value;
  const {error}=await supabase.from('hold_requests').update({status,updated_at:new Date().toISOString()}).eq('id',id);
  if(error){toast(error.message);return;} const hb=b.nextElementSibling; if(hb) hb.classList.remove('show'); toast('Hold request updated');
};

function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}function escAttr(v){return esc(v)}function safeColor(c){return /^#[0-9a-f]{6}$/i.test(c||'')?c:'#22c55e'}
document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));$(b.dataset.page).classList.add('active');if(b.dataset.page==='visitors')loadVisitors();if(b.dataset.page==='holdRequests')loadHoldRequests()});$('logout').onclick=async()=>{await supabase.auth.signOut();location.href='login.html'};
(async()=>{if(await guard())await load()})()

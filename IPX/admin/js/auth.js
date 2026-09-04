import { supabase } from './supabase.js';
const $=id=>document.getElementById(id), msg=$('msg');
function show(m,err=false){msg.textContent=m;msg.className='msg '+(err?'error':'ok')}
$('showRegister').onclick=()=>{$('loginView').hidden=true;$('registerView').hidden=false;show('')};
$('showLogin').onclick=()=>{$('registerView').hidden=true;$('loginView').hidden=false;show('')};
$('registerForm').onsubmit=async e=>{e.preventDefault();show('Creating account...');const {data,error}=await supabase.auth.signUp({email:$('regEmail').value.trim(),password:$('regPassword').value,options:{data:{name:$('name').value.trim()}}});if(error){show(error.message,true);return} if(data.session){location.href='index.html'} else {show('Account created. If email confirmation is enabled, confirm the email, then log in.');$('registerView').hidden=true;$('loginView').hidden=false}};
$('loginForm').onsubmit=async e=>{e.preventDefault();show('Signing in...');const {data,error}=await supabase.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error){show(error.message,true);return} const {data:a,error:ae}=await supabase.from('admin_users').select('user_id').eq('user_id',data.user.id).maybeSingle();if(ae||!a){await supabase.auth.signOut();show('This account is not an admin.',true);return} location.href='index.html'};

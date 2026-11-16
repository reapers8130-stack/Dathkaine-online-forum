const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let me=null;let selectedBoard='';let visibleThreads=[];let openThreadId=null;const isStaff=()=>me&&['admin','moderator'].includes(me.role);
async function api(url,opt){const r=await fetch(url,opt);const text=await r.text();let d=null;if(text){try{d=JSON.parse(text)}catch{throw Error(`Server returned invalid data (${r.status})`)}}if(!r.ok)throw Error((d&&d.error)||`Request failed (${r.status})`);return d}
async function sessionState(){me=await api('/api/me');$('#loggedOut').hidden=!!me;$('#loggedIn').hidden=!me;$('#threadForm').hidden=!me;$('#loginHint').hidden=!!me;if(me)$('#who').textContent=`${me.username} [${me.role}]`;$('#staffPanel').hidden=!isStaff();if(isStaff()){$('#roleLabel').textContent=`Staff role: ${me.role}`;$('#adminUsers').hidden=me.role!=='admin';if(me.role==='admin')loadUsers()}await loadThreads()}
async function auth(k){try{await api('/api/'+k,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:$('#authName').value,password:$('#authPass').value})});$('#authPass').value='';await sessionState();await dashboard()}catch(e){alert(e.message)}}
$('#loginBtn').onclick=()=>auth('login');$('#registerBtn').onclick=()=>auth('register');$('#logoutBtn').onclick=async()=>{await api('/api/logout',{method:'POST'});await sessionState()};
$('#threadForm').onsubmit=async e=>{e.preventDefault();try{await api('/api/threads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:$('#threadTitle').value,board:$('#threadBoard').value,body:$('#threadBody').value})});e.target.reset();loadThreads()}catch(x){alert(x.message)}};
async function loadUsers(){const users=await api('/api/users'),box=$('#userList');box.innerHTML='';users.forEach(u=>{const row=document.createElement('div');row.className='user-row';row.innerHTML=`<strong>${esc(u.username)}</strong><select><option value="member">member</option><option value="moderator">moderator</option><option value="admin">admin</option></select><button>Set Role</button>`;const sel=row.querySelector('select');sel.value=u.role;row.querySelector('button').onclick=async()=>{try{await api('/api/users/'+u.id+'/role',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:sel.value})});await loadUsers()}catch(e){alert(e.message)}};box.appendChild(row)})}
async function mod(method,url,body){try{await api(url,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});loadThreads()}catch(e){alert(e.message)}}
async function loadThreads(){let list=await api('/api/threads');if(selectedBoard)list=list.filter(t=>t.board===selectedBoard);visibleThreads=list;list.sort((a,b)=>(b.pinned===true)-(a.pinned===true));const box=$('#threads');box.innerHTML=list.length?'':'<p>No threads yet.</p>';for(const t of list){const el=document.createElement('article');el.className='thread';el.dataset.threadId=t.id;const badges=`${t.pinned?'<span class="badge">PINNED</span>':''}${t.locked?'<span class="badge">LOCKED</span>':''}`;const replies=(t.replies||[]).filter(r=>!r.deleted).map(r=>`<div class="reply"><div class="meta">${esc(r.author)}</div>${esc(r.body)}${isStaff()?`<div><button class="danger del-reply" data-rid="${r.id}">Delete Reply</button></div>`:''}</div>`).join('');const controls=isStaff()?`<div class="staff-tools"><button class="pin">${t.pinned?'Unpin':'Pin'} Thread</button><button class="lock">${t.locked?'Unlock':'Lock'} Thread</button><button class="danger del">Delete Thread</button></div>`:'';el.innerHTML=`<h3>${esc(t.title)} ${badges}</h3><div class="meta">${esc(t.board)} • ${esc(t.author)} • ${new Date(t.createdAt).toLocaleString()}</div><p>${esc(t.body)}</p>${controls}${replies}${me&&(!t.locked||isStaff())?`<form class="reply-form"><textarea name="body" placeholder="Reply..." required></textarea><button>Reply</button></form>`:''}`;if(isStaff()){el.querySelector('.pin').onclick=()=>mod('PATCH','/api/threads/'+t.id,{pinned:!t.pinned});el.querySelector('.lock').onclick=()=>mod('PATCH','/api/threads/'+t.id,{locked:!t.locked});el.querySelector('.del').onclick=()=>{if(confirm('Delete this thread?'))mod('DELETE','/api/threads/'+t.id)};el.querySelectorAll('.del-reply').forEach(b=>b.onclick=()=>{if(confirm('Delete this reply?'))mod('DELETE',`/api/threads/${t.id}/replies/${b.dataset.rid}`)})}const f=el.querySelector('.reply-form');if(f)f.onsubmit=async e=>{e.preventDefault();try{await api('/api/threads/'+t.id+'/replies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({body:f.body.value})});loadThreads()}catch(x){alert(x.message)}};box.appendChild(el)}}


function openArticleReader(thread){
  const reader=$('#articleReader');
  if(!reader||!thread)return;

  openThreadId=thread.id;

  $('#readerBoard').textContent=thread.board||'Dathkaine Forum';
  $('#readerTitle').textContent=thread.title||'Untitled Thread';
  $('#readerMeta').textContent=`Posted by ${thread.author} • ${new Date(thread.createdAt).toLocaleString()}`;
  $('#readerBody').textContent=thread.body||'';

  const repliesBox=$('#readerReplies');
  const replies=(thread.replies||[]).filter(reply=>!reply.deleted);

  repliesBox.innerHTML='';

  if(!replies.length){
    const empty=document.createElement('p');
    empty.textContent='No replies yet.';
    repliesBox.appendChild(empty);
  }else{
    replies.forEach(reply=>{
      const item=document.createElement('div');
      item.className='reply';

      const meta=document.createElement('div');
      meta.className='meta';
      meta.textContent=`${reply.author} • ${new Date(reply.createdAt).toLocaleString()}`;

      const body=document.createElement('div');
      body.textContent=reply.body;

      item.append(meta,body);
      repliesBox.appendChild(item);
    });
  }

  const replyForm=$('#readerReplyForm');
  replyForm.hidden=!me||(thread.locked&&!isStaff());
  $('#readerReply').value='';

  if(!reader.open)reader.showModal();
}

const articleReader=$('#articleReader');
const closeReader=$('#closeReader');
const readerReplyForm=$('#readerReplyForm');
const threadList=$('#threads');

if(closeReader&&articleReader){
  closeReader.addEventListener('click',()=>articleReader.close());
}

if(articleReader){
  articleReader.addEventListener('click',event=>{
    if(event.target===articleReader)articleReader.close();
  });

  articleReader.addEventListener('close',()=>{
    openThreadId=null;
    $('#readerReply').value='';
  });
}

if(readerReplyForm){
  readerReplyForm.addEventListener('submit',async event=>{
    event.preventDefault();

    const thread=visibleThreads.find(item=>item.id===openThreadId);
    const body=$('#readerReply').value.trim();

    if(!thread||!body)return;

    try{
      await api(`/api/threads/${thread.id}/replies`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({body})
      });

      await loadThreads();

      const refreshed=visibleThreads.find(item=>item.id===openThreadId);
      if(refreshed)openArticleReader(refreshed);
    }catch(error){
      alert(error.message);
    }
  });
}

if(threadList){
  threadList.addEventListener('click',event=>{
    const title=event.target.closest('.thread h3');
    if(!title)return;

    const article=title.closest('.thread');
    const thread=visibleThreads.find(
      item=>item.id===article?.dataset.threadId
    );

    if(thread)openArticleReader(thread);
  });
}

function setupBoards(){
  const boardSelect=$('#threadBoard');
  const postsHeading=document.querySelector('.forum-posts h3');

  document.querySelectorAll('.board').forEach(board=>{
    const heading=board.querySelector('h3');
    if(!heading)return;

    const boardName=heading.textContent.trim();

    if(boardSelect&&!Array.from(boardSelect.options).some(option=>option.value===boardName)){
      const option=document.createElement('option');
      option.value=boardName;
      option.textContent=boardName;
      boardSelect.appendChild(option);
    }

    board.tabIndex=0;
    board.setAttribute('role','button');
    board.setAttribute('aria-label',`Open ${boardName} forum board`);

    const openBoard=async()=>{
      selectedBoard=boardName;

      document.querySelectorAll('.board').forEach(item=>item.classList.remove('selected-board'));
      board.classList.add('selected-board');

      if(boardSelect)boardSelect.value=boardName;
      if(postsHeading)postsHeading.textContent=`${boardName} Threads`;

      await loadThreads();
      document.querySelector('#forumControls')?.scrollIntoView({behavior:'smooth'});
    };

    board.addEventListener('click',openBoard);
    board.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){
        event.preventDefault();
        openBoard();
      }
    });
  });
}


setupBoards();

const boardSelect = $('#threadBoard');

if (boardSelect) {
  boardSelect.addEventListener('change', async () => {
    selectedBoard = boardSelect.value;

    document.querySelectorAll('.board').forEach(board => {
      const name = board.querySelector('h3')?.textContent.trim();
      board.classList.toggle('selected-board', name === selectedBoard);
    });

    const heading = document.querySelector('.forum-posts h3');

    if (heading) {
      heading.textContent = selectedBoard
        ? `${selectedBoard} Threads`
        : 'Recent Posts';
    }

    await loadThreads();
  });
}


const glow=$('#glowButton');if(glow)glow.onclick=()=>document.body.classList.toggle('awake');sessionState();

async function dashboard(){if(!me||me.role!=='admin'){document.querySelector('#adminDashboard').hidden=true;return}document.querySelector('#adminDashboard').hidden=false;try{const users=await api('/api/users');const threads=await api('/api/threads');const replies=threads.reduce((n,t)=>n+(t.replies||[]).filter(x=>!x.deleted).length,0);$('#statUsers').textContent=users.length;$('#statAdmins').textContent=users.filter(u=>u.role==='admin').length;$('#statMods').textContent=users.filter(u=>u.role==='moderator').length;$('#statMembers').textContent=users.filter(u=>u.role==='member').length;$('#statThreads').textContent=threads.length;$('#statReplies').textContent=replies;$('#statLocked').textContent=threads.filter(t=>t.locked).length;$('#statPinned').textContent=threads.filter(t=>t.pinned).length;const box=$('#dashboardUsers');box.innerHTML='';users.forEach(u=>{const d=document.createElement('div');d.className='user-row';d.innerHTML=`<strong>${esc(u.username)}</strong><select><option>member</option><option>moderator</option><option>admin</option></select><button>Set Role</button>`;d.querySelector('select').value=u.role;d.querySelector('button').onclick=async()=>{try{await api('/api/users/'+u.id+'/role',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:d.querySelector('select').value})});dashboard()}catch(e){alert(e.message)}};box.appendChild(d)})}catch(e){console.error(e)}}
$('#refreshDash').onclick=dashboard;setTimeout(dashboard,300);

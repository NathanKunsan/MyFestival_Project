-- MyFestival Row Level Security (RLS) & Policies
-- Target: Supabase (PostgreSQL)

-- 1. Enable RLS on all tables
alter table profiles enable row level security;
alter table festivals enable row level security;
alter table messages enable row level security;
alter table message_revisions enable row level security;
alter table likes enable row level security;
alter table saves enable row level security;
alter table shares enable row level security;
alter table reports enable row level security;
alter table notifications enable row level security;
alter table random_history enable row level security;
alter table activity_logs enable row level security;

-- 2. Helper Functions for Role Checking
create or replace function public.is_admin()
returns boolean as $$
begin
    return exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'admin'
    ) or auth.jwt() ->> 'email' = '6nathan.dev@gmail.com';
end;
$$ language plpgsql security definer;

create or replace function public.is_contributor()
returns boolean as $$
begin
    return exists (
        select 1 from public.profiles
        where id = auth.uid() and role in ('contributor', 'admin')
    ) or auth.jwt() ->> 'email' = '6nathan.dev@gmail.com';
end;
$$ language plpgsql security definer;

-- 3. PROFILES POLICIES
drop policy if exists "Allow public read of profiles" on profiles;
create policy "Allow public read of profiles"
    on profiles for select
    using (true);

drop policy if exists "Allow user to update own profile" on profiles;
create policy "Allow user to update own profile"
    on profiles for update
    using (auth.uid() = id)
    with check (
        -- Standard users cannot escalate their role to admin/contributor unless they are admin already or they are the system developer email
        role = (select role from public.profiles where id = auth.uid()) or is_admin() or auth.jwt() ->> 'email' = '6nathan.dev@gmail.com'
    );

drop policy if exists "Allow admin full control on profiles" on profiles;
create policy "Allow admin full control on profiles"
    on profiles for all
    using (is_admin())
    with check (is_admin());

drop policy if exists "Allow user to insert own profile" on profiles;
create policy "Allow user to insert own profile"
    on profiles for insert
    with check (auth.uid() = id and role in ('member', 'contributor'));

-- 4. FESTIVALS POLICIES
drop policy if exists "Allow public read of festivals" on festivals;
create policy "Allow public read of festivals"
    on festivals for select
    using (true);

drop policy if exists "Allow admin full control on festivals" on festivals;
create policy "Allow admin full control on festivals"
    on festivals for all
    using (is_admin())
    with check (is_admin());

-- 5. MESSAGES POLICIES
drop policy if exists "Allow public read of approved messages" on messages;
create policy "Allow public read of approved messages"
    on messages for select
    using (status = 'approved' or auth.uid() = contributor_id or is_admin());

drop policy if exists "Allow contributors to insert messages" on messages;
create policy "Allow contributors to insert messages"
    on messages for insert
    with check (auth.uid() = contributor_id and is_contributor());

drop policy if exists "Allow owners to update pending/rejected messages" on messages;
create policy "Allow owners to update pending/rejected messages"
    on messages for update
    using (auth.uid() = contributor_id and (status in ('pending', 'rejected')) or is_admin())
    with check (auth.uid() = contributor_id and (status = 'pending') or is_admin());

drop policy if exists "Allow owners to delete own messages" on messages;
create policy "Allow owners to delete own messages"
    on messages for delete
    using (auth.uid() = contributor_id);

drop policy if exists "Allow admin full control on messages" on messages;
create policy "Allow admin full control on messages"
    on messages for all
    using (is_admin())
    with check (is_admin());

-- 6. MESSAGE REVISIONS POLICIES
drop policy if exists "Allow owner and admin to view revisions" on message_revisions;
create policy "Allow owner and admin to view revisions"
    on message_revisions for select
    using (
        exists (
            select 1 from public.messages m 
            where m.id = message_id and (m.contributor_id = auth.uid() or is_admin())
        )
    );

drop policy if exists "Allow owner to insert revisions" on message_revisions;
create policy "Allow owner to insert revisions"
    on message_revisions for insert
    with check (
        exists (
            select 1 from public.messages m 
            where m.id = message_id and m.contributor_id = auth.uid()
        )
    );

drop policy if exists "Allow admin full control on revisions" on message_revisions;
create policy "Allow admin full control on revisions"
    on message_revisions for all
    using (is_admin())
    with check (is_admin());

-- 7. LIKES POLICIES
drop policy if exists "Allow public read of likes" on likes;
create policy "Allow public read of likes"
    on likes for select
    using (true);

drop policy if exists "Allow authenticated user to manage own likes" on likes;
create policy "Allow authenticated user to manage own likes"
    on likes for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- 8. SAVES POLICIES
drop policy if exists "Allow owner to manage own saves" on saves;
create policy "Allow owner to manage own saves"
    on saves for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- 9. SHARES POLICIES
drop policy if exists "Allow public insertion of shares" on shares;
create policy "Allow public insertion of shares"
    on shares for insert
    with check (true);

drop policy if exists "Allow public read of shares" on shares;
create policy "Allow public read of shares"
    on shares for select
    using (true);

-- 10. REPORTS POLICIES
drop policy if exists "Allow public insertion of reports" on reports;
create policy "Allow public insertion of reports"
    on reports for insert
    with check (true);

drop policy if exists "Allow admin to manage reports" on reports;
create policy "Allow admin to manage reports"
    on reports for all
    using (is_admin())
    with check (is_admin());

-- 11. NOTIFICATIONS POLICIES
drop policy if exists "Allow users to read/update own notifications" on notifications;
create policy "Allow users to read/update own notifications"
    on notifications for select
    using (auth.uid() = user_id or (user_id is null and is_admin()));

drop policy if exists "Allow users to mark own notifications as read" on notifications;
create policy "Allow users to mark own notifications as read"
    on notifications for update
    using (auth.uid() = user_id or (user_id is null and is_admin()))
    with check (auth.uid() = user_id or (user_id is null and is_admin()));

drop policy if exists "Allow public/system to insert notifications" on notifications;
create policy "Allow public/system to insert notifications"
    on notifications for insert
    with check (true);

-- 12. RANDOM HISTORY POLICIES
drop policy if exists "Allow user to manage own random history" on random_history;
create policy "Allow user to manage own random history"
    on random_history for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- 13. ACTIVITY LOGS POLICIES
drop policy if exists "Allow anyone to insert activity logs" on activity_logs;
create policy "Allow anyone to insert activity logs"
    on activity_logs for insert
    with check (user_id is null or auth.uid() = user_id);

drop policy if exists "Allow admin to read activity logs" on activity_logs;
create policy "Allow admin to read activity logs"
    on activity_logs for select
    using (is_admin());


-- 14. AUTOMATION TRIGGERS FOR NOTIFICATIONS
-- A. Trigger for Auto-Notifying Admins on New Reports
create or replace function public.notify_admin_on_report()
returns trigger as $$
declare
    msg_preview text;
begin
    select substring(message_text from 1 for 40) into msg_preview from public.messages where id = new.message_id;
    insert into public.notifications (user_id, title, content, type)
    values (
        null, -- null represents notification for admins
        '🚩 รายงานคำอวยพรไม่เหมาะสม',
        'ข้อความ: "' || coalesce(msg_preview, '') || '..." ถูกรายงานด้วยเหตุผล: ' || new.reason,
        'report'
    );
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_report_created on public.reports;
create trigger on_report_created
    after insert on public.reports
    for each row execute procedure public.notify_admin_on_report();

-- B. Trigger for Auto-Notifying Contributors on Message Status Change
create or replace function public.notify_contributor_on_status_change()
returns trigger as $$
declare
    msg_preview text;
begin
    if old.status <> new.status then
        msg_preview := substring(new.message_text from 1 for 40);
        insert into public.notifications (user_id, title, content, type)
        values (
            new.contributor_id,
            case 
                when new.status = 'approved' then '🎉 คำอวยพรได้รับการอนุมัติแล้ว!'
                else '⚠️ คำอวยพรไม่ได้รับการอนุมัติ'
            end,
            case 
                when new.status = 'approved' then 'คำอวยพรของคุณ: "' || msg_preview || '..." ได้รับการอนุมัติเข้าระบบแล้ว'
                else 'คำอวยพรของคุณ: "' || msg_preview || '..." ถูกปฏิเสธเนื่องจาก: ' || coalesce(new.rejection_reason, 'ไม่ผ่านเกณฑ์การพิจารณา')
            end,
            case 
                when new.status = 'approved' then 'approval'
                else 'rejection'
            end
        );
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_message_status_changed on public.messages;
create trigger on_message_status_changed
    after update of status on public.messages
    for each row execute procedure public.notify_contributor_on_status_change();


-- 15. FESTIVAL SUGGESTIONS POLICIES
alter table festival_suggestions enable row level security;

drop policy if exists "Allow select suggestions for admins and owners" on festival_suggestions;
create policy "Allow select suggestions for admins and owners"
    on festival_suggestions for select
    using (
        auth.jwt() ->> 'email' = '6nathan.dev@gmail.com' or 
        exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') or
        auth.uid() = suggested_by
    );

drop policy if exists "Allow anyone to insert suggestions" on festival_suggestions;
create policy "Allow anyone to insert suggestions"
    on festival_suggestions for insert
    with check (auth.uid() = suggested_by);

drop policy if exists "Allow admins to delete/update suggestions" on festival_suggestions;
create policy "Allow admins to delete/update suggestions"
    on festival_suggestions for all
    using (
        auth.jwt() ->> 'email' = '6nathan.dev@gmail.com' or 
        exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    )
    with check (
        auth.jwt() ->> 'email' = '6nathan.dev@gmail.com' or 
        exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    );

-- 16. ABOUT INFO POLICIES
alter table about_info enable row level security;

drop policy if exists "Allow public read of about_info" on about_info;
create policy "Allow public read of about_info"
    on about_info for select
    using (true);

drop policy if exists "Allow admin full control on about_info" on about_info;
create policy "Allow admin full control on about_info"
    on about_info for all
    using (
        auth.jwt() ->> 'email' = '6nathan.dev@gmail.com' or 
        exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    )
    with check (
        auth.jwt() ->> 'email' = '6nathan.dev@gmail.com' or 
        exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    );

-- 16.5. CHAT MESSAGES POLICIES
alter table public.chat_messages enable row level security;

drop policy if exists "Allow users to send chat messages" on public.chat_messages;
create policy "Allow users to send chat messages"
    on public.chat_messages for insert
    to authenticated
    with check (auth.uid() = sender_id);

drop policy if exists "Allow users to read their own chats" on public.chat_messages;
create policy "Allow users to read their own chats"
    on public.chat_messages for select
    to authenticated
    using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Allow receivers to update read status" on public.chat_messages;
create policy "Allow receivers to update read status"
    on public.chat_messages for update
    to authenticated
    using (auth.uid() = receiver_id)
    with check (auth.uid() = receiver_id);

-- 17. ENABLE REAL-TIME FOR ALL APP TABLES
drop publication if exists supabase_realtime;
create publication supabase_realtime for table profiles, messages, message_revisions, reports, festivals, notifications, festival_suggestions, about_info, chat_messages;

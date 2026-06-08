-- Create chat_messages table
create table if not exists public.chat_messages (
    id uuid primary key default gen_random_uuid(),
    sender_id uuid not null references public.profiles(id) on delete cascade,
    receiver_id uuid not null references public.profiles(id) on delete cascade,
    message text not null check (char_length(message) > 0),
    is_read boolean default false not null,
    created_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.chat_messages enable row level security;

-- RLS Policies
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

-- Register to Supabase Realtime publication (Drop & Recreate to avoid "already member" error)
drop publication if exists supabase_realtime;
create publication supabase_realtime for table profiles, messages, message_revisions, reports, festivals, notifications, festival_suggestions, about_info, chat_messages;


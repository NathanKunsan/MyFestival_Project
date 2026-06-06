-- MyFestival Database Schema
-- Target: Supabase (PostgreSQL)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Clean up existing tables if any (for fresh migration)
drop table if exists activity_logs cascade;
drop table if exists random_history cascade;
drop table if exists notifications cascade;
drop table if exists reports cascade;
drop table if exists shares cascade;
drop table if exists saves cascade;
drop table if exists likes cascade;
drop table if exists message_revisions cascade;
drop table if exists messages cascade;
drop table if exists festivals cascade;
drop table if exists profiles cascade;
drop table if exists festival_suggestions cascade;
drop table if exists about_info cascade;

-- 1. PROFILES Table (Extends auth.users)
create table profiles (
    id uuid primary key references auth.users on delete cascade,
    email text unique not null,
    full_name text,
    pending_name text,
    avatar_url text,
    role text not null default 'member' check (role in ('member', 'contributor', 'admin')),
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

-- 2. FESTIVALS Table
create table festivals (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text,
    image_url text,
    start_date timestamp with time zone not null,
    end_date timestamp with time zone not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

-- 3. MESSAGES Table
create table messages (
    id uuid primary key default gen_random_uuid(),
    festival_id uuid not null references festivals(id) on delete cascade,
    contributor_id uuid not null references profiles(id) on delete cascade,
    message_text text not null check (char_length(message_text) > 0),
    signature text,
    is_anonymous boolean default false not null,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    rejection_reason text,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

-- 4. MESSAGE REVISIONS Table
create table message_revisions (
    id uuid primary key default gen_random_uuid(),
    message_id uuid not null references messages(id) on delete cascade,
    festival_id uuid references festivals(id) on delete cascade,
    message_text text not null check (char_length(message_text) > 0),
    signature text,
    is_anonymous boolean default false not null,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    rejection_reason text,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

-- 5. LIKES Table (1 like per user per message)
create table likes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references profiles(id) on delete cascade,
    message_id uuid not null references messages(id) on delete cascade,
    created_at timestamp with time zone default now() not null,
    constraint unique_user_message_like unique (user_id, message_id)
);

-- 6. SAVES Table (Bookmark wishes)
create table saves (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references profiles(id) on delete cascade,
    message_id uuid not null references messages(id) on delete cascade,
    created_at timestamp with time zone default now() not null,
    constraint unique_user_message_save unique (user_id, message_id)
);

-- 7. SHARES Table
create table shares (
    id uuid primary key default gen_random_uuid(),
    message_id uuid not null references messages(id) on delete cascade,
    share_type text not null check (share_type in ('url', 'card')),
    created_at timestamp with time zone default now() not null
);

-- 8. REPORTS Table
create table reports (
    id uuid primary key default gen_random_uuid(),
    reporter_id uuid references profiles(id) on delete set null,
    message_id uuid not null references messages(id) on delete cascade,
    reason text not null check (char_length(reason) > 0),
    status text not null default 'pending' check (status in ('pending', 'resolved')),
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

-- 9. NOTIFICATIONS Table
create table notifications (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references profiles(id) on delete cascade, -- null indicates system/admin notifications
    title text not null,
    content text not null,
    is_read boolean default false not null,
    type text not null check (type in ('report', 'approval', 'rejection', 'system')),
    created_at timestamp with time zone default now() not null
);

-- 10. RANDOM HISTORY Table (For duplicate prevention)
create table random_history (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references profiles(id) on delete cascade,
    festival_id uuid not null references festivals(id) on delete cascade,
    message_id uuid not null references messages(id) on delete cascade,
    created_at timestamp with time zone default now() not null,
    constraint unique_user_festival_message_history unique (user_id, festival_id, message_id)
);

-- 11. ACTIVITY LOGS Table
create table activity_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references profiles(id) on delete set null,
    action text not null,
    details jsonb default '{}'::jsonb not null,
    created_at timestamp with time zone default now() not null
);

-- 12. FESTIVAL SUGGESTIONS Table
create table if not exists festival_suggestions (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    description text not null,
    suggested_wish text not null,
    signature text,
    is_anonymous boolean default false not null,
    suggested_by uuid references profiles(id) on delete cascade,
    image_url text,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

-- 13. ABOUT INFO Table
create table if not exists about_info (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    content text not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

-- COMMON TRIGGERS FOR updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_profiles_modtime before update on profiles for each row execute procedure update_updated_at_column();
create trigger update_festivals_modtime before update on festivals for each row execute procedure update_updated_at_column();
create trigger update_messages_modtime before update on messages for each row execute procedure update_updated_at_column();
create trigger update_message_revisions_modtime before update on message_revisions for each row execute procedure update_updated_at_column();
create trigger update_reports_modtime before update on reports for each row execute procedure update_updated_at_column();
create trigger update_festival_suggestions_modtime before update on festival_suggestions for each row execute procedure update_updated_at_column();
create trigger update_about_info_modtime before update on about_info for each row execute procedure update_updated_at_column();

-- AUTOMATIC PROFILE CREATION FROM auth.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, email, full_name, avatar_url, role)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', ''),
        case
            when new.email = '6nathan.dev@gmail.com' then 'admin'
            else 
                case
                    when new.raw_user_meta_data->>'role' = 'contributor' then 'contributor'
                    else 'member'
                end
        end
    );
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();



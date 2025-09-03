-- Update the handle_new_user function to set approved = true by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    user_name TEXT;
    user_phone TEXT;
    user_telegram TEXT;
BEGIN
    -- Extract user metadata
    user_name := COALESCE(
        NEW.raw_user_meta_data ->> 'name',
        NEW.raw_user_meta_data ->> 'full_name',
        SPLIT_PART(NEW.email, '@', 1)
    );
    
    user_phone := COALESCE(
        NEW.raw_user_meta_data ->> 'phone',
        NEW.phone,
        ''
    );
    
    user_telegram := NEW.raw_user_meta_data ->> 'telegram_id';
    
    -- Insert into users table with approved = true (auto-approve new users)
    INSERT INTO public.users (
        auth_user_id,
        name,
        email,
        phone,
        telegram_id,
        approved
    )
    VALUES (
        NEW.id,
        user_name,
        NEW.email,
        user_phone,
        user_telegram,
        true  -- Auto-approve all new users
    );
    
    RETURN NEW;
END;
$function$;

-- Update existing users to be approved
UPDATE public.users SET approved = true WHERE approved = false;
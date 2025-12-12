/*
  # Corrigir funções RPC com erros de SQL

  1. Corrigir get_voucher_stats - resolver referência ambígua de created_at
  2. Corrigir get_all_user_profiles - resolver problema de GROUP BY
  
  ## Problemas corrigidos:
  - Referência ambígua à coluna created_at em get_voucher_stats
  - Coluna p.created_at não incluída no GROUP BY em get_all_user_profiles
*/

-- Corrigir função get_voucher_stats
CREATE OR REPLACE FUNCTION get_voucher_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'stats', json_build_object(
      'total_vouchers', (SELECT COUNT(*) FROM vouchers),
      'used_vouchers', (SELECT COUNT(*) FROM vouchers WHERE is_used = true),
      'unused_vouchers', (SELECT COUNT(*) FROM vouchers WHERE is_used = false),
      'recent_vouchers', (
        SELECT COALESCE(json_agg(
          json_build_object(
            'code', v.code,
            'is_used', v.is_used,
            'used_by', p.full_name,
            'used_at', v.used_at,
            'created_at', v.created_at
          ) ORDER BY v.created_at DESC
        ), '[]'::json)
        FROM vouchers v
        LEFT JOIN profiles p ON v.used_by_user_id = p.id
        WHERE v.created_at >= NOW() - INTERVAL '30 days'
        LIMIT 50
      )
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Corrigir função get_all_user_profiles
CREATE OR REPLACE FUNCTION get_all_user_profiles()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'users', COALESCE(json_agg(
      json_build_object(
        'id', p.id,
        'full_name', p.full_name,
        'phone', p.phone,
        'role', p.role,
        'allowed_sessions', p.allowed_sessions,
        'is_blocked', p.is_blocked,
        'created_at', p.created_at,
        'active_sessions_count', COALESCE(active_sessions.count, 0),
        'total_sessions_count', COALESCE(total_sessions.count, 0)
      ) ORDER BY p.created_at DESC
    ), '[]'::json)
  ) INTO result
  FROM profiles p
  LEFT JOIN (
    SELECT admin_id, COUNT(*) as count
    FROM tracking_sessions 
    WHERE status = 'active'
    GROUP BY admin_id
  ) active_sessions ON p.id = active_sessions.admin_id
  LEFT JOIN (
    SELECT admin_id, COUNT(*) as count
    FROM tracking_sessions
    GROUP BY admin_id
  ) total_sessions ON p.id = total_sessions.admin_id
  WHERE p.role = 'vendor';
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;